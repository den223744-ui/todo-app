"""List business logic. Every query is scoped to the caller's workspace."""

import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Select, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, NotFoundError
from app.core.time import utcnow
from app.models import TaskList
from app.models.task_list import LIST_COLORS
from app.schemas.task_list import TaskListCreate, TaskListUpdate

POSITION_STEP = 1.0
DUPLICATE_NAME = "A list with this name already exists"


def name_key(name: str) -> str:
    """'Работа' and 'РАБОТА' are the same list."""
    return name.casefold()


def _scoped(workspace_id: uuid.UUID) -> Select[TaskList]:
    return select(TaskList).where(TaskList.workspace_id == workspace_id)


async def list_lists(session: AsyncSession, workspace_id: uuid.UUID) -> Sequence[TaskList]:
    query = _scoped(workspace_id).order_by(TaskList.position, TaskList.created_at, TaskList.id)
    return (await session.scalars(query)).all()


async def get_list(
    session: AsyncSession, workspace_id: uuid.UUID, list_id: uuid.UUID, *, lock: bool = False
) -> TaskList:
    """A list of the workspace; 404 for a missing list or one of another workspace.

    ``lock=True`` (FOR KEY SHARE on PostgreSQL) keeps the list from being
    deleted until commit, so a task can safely be put into it.
    """
    query = _scoped(workspace_id).where(TaskList.id == list_id)
    if lock:
        query = query.with_for_update(key_share=True)
    task_list = await session.scalar(query)
    if task_list is None:
        raise NotFoundError("List not found")
    return task_list


async def _ensure_unique_name(
    session: AsyncSession, workspace_id: uuid.UUID, key: str, *, except_id: uuid.UUID | None
) -> None:
    query = _scoped(workspace_id).where(TaskList.name_key == key)
    if except_id is not None:
        query = query.where(TaskList.id != except_id)
    if await session.scalar(query) is not None:
        raise ConflictError(DUPLICATE_NAME)


async def _commit(session: AsyncSession) -> None:
    """Commit; a concurrent list with the same name surfaces as 409, not 500."""
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise ConflictError(DUPLICATE_NAME) from None


async def create_list(
    session: AsyncSession,
    workspace_id: uuid.UUID,
    data: TaskListCreate,
    *,
    now: datetime | None = None,
) -> TaskList:
    now = now or utcnow()
    key = name_key(data.name)
    await _ensure_unique_name(session, workspace_id, key, except_id=None)

    count, last = (
        await session.execute(
            select(func.count(TaskList.id), func.max(TaskList.position)).where(
                TaskList.workspace_id == workspace_id
            )
        )
    ).one()
    position = data.position
    if position is None:
        position = POSITION_STEP if last is None else last + POSITION_STEP

    task_list = TaskList(
        workspace_id=workspace_id,
        name=data.name,
        name_key=key,
        color=data.color or LIST_COLORS[count % len(LIST_COLORS)],
        position=position,
        created_at=now,
        updated_at=now,
    )
    session.add(task_list)
    await _commit(session)
    return task_list


async def update_list(
    session: AsyncSession,
    workspace_id: uuid.UUID,
    list_id: uuid.UUID,
    data: TaskListUpdate,
    *,
    now: datetime | None = None,
) -> TaskList:
    now = now or utcnow()
    task_list = await get_list(session, workspace_id, list_id)
    changes = data.changes()
    if "name" in changes:
        key = name_key(changes["name"])
        await _ensure_unique_name(session, workspace_id, key, except_id=task_list.id)
        task_list.name_key = key
    for field, value in changes.items():
        setattr(task_list, field, value)
    if changes:
        task_list.updated_at = now
    await _commit(session)
    return task_list


async def delete_list(session: AsyncSession, workspace_id: uuid.UUID, list_id: uuid.UUID) -> None:
    """Delete the list for good; its tasks stay, without a list (ON DELETE SET NULL)."""
    task_list = await get_list(session, workspace_id, list_id)
    await session.delete(task_list)
    await session.commit()
