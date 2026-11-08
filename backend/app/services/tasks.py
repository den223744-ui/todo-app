"""Task business logic.

Every function takes the caller's ``workspace_id`` and every query filters by
it: a task of another workspace behaves exactly like a missing one (404).
"""

import uuid
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Select, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, InvalidRequestError, NotFoundError
from app.core.time import utcnow
from app.models import Task
from app.schemas.task import TaskCreate, TaskUpdate

# Gap between the last task and a newly appended one. Reordering (Stage 4)
# places a moved task at the midpoint between its new neighbours.
POSITION_STEP = 1.0


def _scoped(workspace_id: uuid.UUID) -> Select[Task]:
    return select(Task).where(Task.workspace_id == workspace_id)


async def list_tasks(session: AsyncSession, workspace_id: uuid.UUID) -> Sequence[Task]:
    """All live tasks of the workspace as a flat list; subtasks carry parent_id."""
    query = (
        _scoped(workspace_id)
        .where(Task.deleted_at.is_(None))
        .order_by(Task.position, Task.created_at, Task.id)
    )
    return (await session.scalars(query)).all()


async def _get_task(
    session: AsyncSession, workspace_id: uuid.UUID, task_id: uuid.UUID, *, deleted: bool
) -> Task:
    deleted_filter = Task.deleted_at.is_not(None) if deleted else Task.deleted_at.is_(None)
    task = await session.scalar(_scoped(workspace_id).where(Task.id == task_id, deleted_filter))
    if task is None:
        raise NotFoundError("Task not found")
    return task


async def get_task(session: AsyncSession, workspace_id: uuid.UUID, task_id: uuid.UUID) -> Task:
    return await _get_task(session, workspace_id, task_id, deleted=False)


async def _next_position(
    session: AsyncSession, workspace_id: uuid.UUID, parent_id: uuid.UUID | None
) -> float:
    siblings = Task.parent_id.is_(None) if parent_id is None else Task.parent_id == parent_id
    last = await session.scalar(
        select(func.max(Task.position)).where(
            Task.workspace_id == workspace_id, Task.deleted_at.is_(None), siblings
        )
    )
    return POSITION_STEP if last is None else last + POSITION_STEP


async def create_task(
    session: AsyncSession,
    workspace_id: uuid.UUID,
    data: TaskCreate,
    *,
    now: datetime | None = None,
) -> Task:
    now = now or utcnow()
    if data.parent_id is not None:
        try:
            parent = await get_task(session, workspace_id, data.parent_id)
        except NotFoundError:
            raise NotFoundError("Parent task not found") from None
        if parent.parent_id is not None:
            raise InvalidRequestError("Subtasks cannot have subtasks (one level of nesting)")

    position = data.position
    if position is None:
        position = await _next_position(session, workspace_id, data.parent_id)

    task = Task(
        workspace_id=workspace_id,
        parent_id=data.parent_id,
        title=data.title,
        notes=data.notes,
        priority=data.priority,
        due_date=data.due_date,
        due_time=data.due_time,
        tags=data.tags,
        position=position,
        created_at=now,
        updated_at=now,
    )
    session.add(task)
    await session.commit()
    return task


async def update_task(
    session: AsyncSession,
    workspace_id: uuid.UUID,
    task_id: uuid.UUID,
    data: TaskUpdate,
    *,
    now: datetime | None = None,
) -> Task:
    now = now or utcnow()
    task = await get_task(session, workspace_id, task_id)
    changes = data.changes()

    completed = changes.pop("completed", None)

    # A time without a date means nothing: clearing the date clears the time.
    if "due_date" in changes and changes["due_date"] is None and "due_time" not in changes:
        changes["due_time"] = None
    # Validate the resulting state before touching the task.
    due_date = changes.get("due_date", task.due_date)
    due_time = changes.get("due_time", task.due_time)
    if due_time is not None and due_date is None:
        raise InvalidRequestError("due_time requires due_date")

    for field, value in changes.items():
        setattr(task, field, value)

    if completed is True and task.completed_at is None:
        task.completed_at = now
    elif completed is False:
        task.completed_at = None
    # completed=True on an already completed task keeps the original time.

    if changes or completed is not None:
        task.updated_at = now
    await session.commit()
    return task


async def delete_task(
    session: AsyncSession,
    workspace_id: uuid.UUID,
    task_id: uuid.UUID,
    *,
    now: datetime | None = None,
) -> None:
    """Soft delete the task together with its live subtasks.

    They share one ``deleted_at`` value, which is how restore tells them
    apart from subtasks deleted earlier on their own.
    """
    now = now or utcnow()
    task = await get_task(session, workspace_id, task_id)
    await session.execute(
        update(Task)
        .where(
            Task.workspace_id == workspace_id,
            Task.deleted_at.is_(None),
            (Task.id == task.id) | (Task.parent_id == task.id),
        )
        .values(deleted_at=now, updated_at=now)
        .execution_options(synchronize_session="fetch")
    )
    await session.commit()


async def restore_task(
    session: AsyncSession,
    workspace_id: uuid.UUID,
    task_id: uuid.UUID,
    *,
    now: datetime | None = None,
) -> Task:
    """Undo a delete: bring back the task and the subtasks deleted with it."""
    now = now or utcnow()
    task = await _get_task(session, workspace_id, task_id, deleted=True)

    if task.parent_id is not None:
        parent = await session.get(Task, task.parent_id)
        if parent is None or parent.deleted_at is not None:
            raise ConflictError("Restore the parent task first")

    deleted_at = task.deleted_at
    await session.execute(
        update(Task)
        .where(
            Task.workspace_id == workspace_id,
            (Task.id == task.id) | ((Task.parent_id == task.id) & (Task.deleted_at == deleted_at)),
        )
        .values(deleted_at=None, updated_at=now)
        .execution_options(synchronize_session="fetch")
    )
    await session.commit()
    await session.refresh(task)
    return task
