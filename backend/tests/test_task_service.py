"""Task service: business rules and workspace scoping, below the HTTP layer."""

import uuid
from datetime import UTC, date, datetime, time, timedelta
from typing import Any

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError, InvalidRequestError, NotFoundError
from app.models import Task
from app.schemas.task import TaskCreate, TaskUpdate
from app.services import tasks as service
from app.services.workspaces import create_workspace

pytestmark = pytest.mark.anyio

T0 = datetime(2026, 11, 8, 12, 0, tzinfo=UTC)


def later(minutes: int) -> datetime:
    return T0 + timedelta(minutes=minutes)


@pytest.fixture
async def ws(session: AsyncSession) -> uuid.UUID:
    return (await create_workspace(session)).id


@pytest.fixture
async def other_ws(session: AsyncSession) -> uuid.UUID:
    return (await create_workspace(session)).id


async def create(session: AsyncSession, ws: uuid.UUID, title: str = "Task", **fields: Any) -> Task:
    data = TaskCreate.model_validate({"title": title, **fields})
    return await service.create_task(session, ws, data, now=T0)


async def update(
    session: AsyncSession, ws: uuid.UUID, task: Task, now: datetime = T0, **fields: Any
) -> Task:
    data = TaskUpdate.model_validate(fields)
    return await service.update_task(session, ws, task.id, data, now=now)


async def stored(session: AsyncSession, task_id: uuid.UUID) -> Task:
    task = await session.get(Task, task_id, populate_existing=True)
    assert task is not None
    return task


async def live_ids(session: AsyncSession, ws: uuid.UUID) -> list[uuid.UUID]:
    return [task.id for task in await service.list_tasks(session, ws)]


# --- create -----------------------------------------------------------------


async def test_create_stores_all_fields(session: AsyncSession, ws: uuid.UUID) -> None:
    task = await create(
        session,
        ws,
        "Купить молоко",
        notes="2 литра",
        priority=2,
        due_date="2026-11-09",
        due_time="18:00",
        tags=["#Дом"],
    )

    saved = await stored(session, task.id)
    assert saved.workspace_id == ws
    assert saved.title == "Купить молоко"
    assert saved.notes == "2 литра"
    assert saved.priority == 2
    assert saved.due_date == date(2026, 11, 9)
    assert saved.due_time == time(18, 0)
    assert saved.tags == ["дом"]
    assert saved.created_at == saved.updated_at == T0
    assert saved.completed_at is None
    assert saved.deleted_at is None


async def test_new_tasks_are_appended(session: AsyncSession, ws: uuid.UUID) -> None:
    first = await create(session, ws)
    second = await create(session, ws)
    explicit = await create(session, ws, position=10.5)
    after_explicit = await create(session, ws)

    assert (first.position, second.position) == (1.0, 2.0)
    assert explicit.position == 10.5
    assert after_explicit.position == 11.5


async def test_positions_are_per_list(
    session: AsyncSession, ws: uuid.UUID, other_ws: uuid.UUID
) -> None:
    parent = await create(session, ws, position=5.0)
    await create(session, other_ws, position=100.0)

    first_sub = await create(session, ws, parent_id=str(parent.id))
    second_sub = await create(session, ws, parent_id=str(parent.id))
    top_level = await create(session, ws)

    assert (first_sub.position, second_sub.position) == (1.0, 2.0)
    assert top_level.position == 6.0


async def test_deleted_tasks_do_not_affect_append_position(
    session: AsyncSession, ws: uuid.UUID
) -> None:
    await create(session, ws, position=1.0)
    last = await create(session, ws, position=50.0)
    await service.delete_task(session, ws, last.id, now=T0)

    assert (await create(session, ws)).position == 2.0


async def test_create_subtask(session: AsyncSession, ws: uuid.UUID) -> None:
    parent = await create(session, ws)

    sub = await create(session, ws, parent_id=str(parent.id))

    assert sub.parent_id == parent.id


async def test_subtask_of_subtask_is_rejected(session: AsyncSession, ws: uuid.UUID) -> None:
    parent = await create(session, ws)
    sub = await create(session, ws, parent_id=str(parent.id))

    with pytest.raises(InvalidRequestError, match="one level"):
        await create(session, ws, parent_id=str(sub.id))


@pytest.mark.parametrize("parent", ["missing", "deleted", "other-workspace"])
async def test_parent_must_be_a_live_task_of_the_workspace(
    session: AsyncSession, ws: uuid.UUID, other_ws: uuid.UUID, parent: str
) -> None:
    if parent == "missing":
        parent_id = uuid.uuid4()
    elif parent == "deleted":
        task = await create(session, ws)
        await service.delete_task(session, ws, task.id, now=T0)
        parent_id = task.id
    else:
        parent_id = (await create(session, other_ws)).id

    with pytest.raises(NotFoundError, match="Parent task not found"):
        await create(session, ws, parent_id=str(parent_id))


# --- list -------------------------------------------------------------------


async def test_list_is_flat_ordered_and_scoped(
    session: AsyncSession, ws: uuid.UUID, other_ws: uuid.UUID
) -> None:
    b = await create(session, ws, "b", position=2.0)
    a = await create(session, ws, "a", position=1.0)
    sub = await create(session, ws, "sub", parent_id=str(a.id), position=1.5)
    gone = await create(session, ws, "gone", position=0.5)
    await service.delete_task(session, ws, gone.id, now=T0)
    await create(session, other_ws, "foreign", position=0.1)

    assert await live_ids(session, ws) == [a.id, sub.id, b.id]


# --- get / update -----------------------------------------------------------


@pytest.mark.parametrize("case", ["missing", "deleted", "other-workspace"])
async def test_get_update_delete_hide_unavailable_tasks(
    session: AsyncSession, ws: uuid.UUID, other_ws: uuid.UUID, case: str
) -> None:
    if case == "missing":
        task_id = uuid.uuid4()
    elif case == "deleted":
        task_id = (await create(session, ws)).id
        await service.delete_task(session, ws, task_id, now=T0)
    else:
        task_id = (await create(session, other_ws)).id

    with pytest.raises(NotFoundError, match="Task not found"):
        await service.get_task(session, ws, task_id)
    with pytest.raises(NotFoundError):
        await service.update_task(session, ws, task_id, TaskUpdate(title="x"))
    with pytest.raises(NotFoundError):
        await service.delete_task(session, ws, task_id)


async def test_foreign_task_is_left_untouched(
    session: AsyncSession, ws: uuid.UUID, other_ws: uuid.UUID
) -> None:
    foreign = await create(session, other_ws, "theirs")

    with pytest.raises(NotFoundError):
        await service.update_task(session, ws, foreign.id, TaskUpdate(title="mine"))
    with pytest.raises(NotFoundError):
        await service.delete_task(session, ws, foreign.id)

    saved = await stored(session, foreign.id)
    assert saved.title == "theirs"
    assert saved.deleted_at is None


async def test_update_applies_only_sent_fields(session: AsyncSession, ws: uuid.UUID) -> None:
    task = await create(session, ws, "t", notes="keep", priority=1, tags=["a"])

    await update(session, ws, task, now=later(5), title=" new ", tags=["#B"])

    saved = await stored(session, task.id)
    assert saved.title == "new"
    assert saved.tags == ["b"]
    assert saved.notes == "keep"
    assert saved.priority == 1
    assert saved.created_at == T0
    assert saved.updated_at == later(5)


async def test_update_clears_optional_fields(session: AsyncSession, ws: uuid.UUID) -> None:
    task = await create(session, ws, notes="n", due_date="2026-11-09", due_time="18:00")

    await update(session, ws, task, notes=None, due_time=None)

    saved = await stored(session, task.id)
    assert saved.notes is None
    assert saved.due_time is None
    assert saved.due_date == date(2026, 11, 9)


async def test_clearing_date_clears_time(session: AsyncSession, ws: uuid.UUID) -> None:
    task = await create(session, ws, due_date="2026-11-09", due_time="18:00")

    await update(session, ws, task, due_date=None)

    saved = await stored(session, task.id)
    assert (saved.due_date, saved.due_time) == (None, None)


@pytest.mark.parametrize(
    ("initial", "patch"),
    [
        pytest.param({}, {"due_time": "18:00"}, id="time-on-task-without-date"),
        pytest.param(
            {"due_date": "2026-11-09"},
            {"due_date": None, "due_time": "18:00"},
            id="clear-date-but-set-time",
        ),
    ],
)
async def test_time_without_date_is_rejected_and_task_unchanged(
    session: AsyncSession, ws: uuid.UUID, initial: dict[str, Any], patch: dict[str, Any]
) -> None:
    task = await create(session, ws, "before", **initial)

    with pytest.raises(InvalidRequestError, match="due_time requires due_date"):
        await update(session, ws, task, title="after", **patch)

    saved = await stored(session, task.id)
    assert saved.title == "before"
    assert saved.due_time is None


async def test_complete_and_reopen(session: AsyncSession, ws: uuid.UUID) -> None:
    task = await create(session, ws)

    await update(session, ws, task, now=later(1), completed=True)
    assert (await stored(session, task.id)).completed_at == later(1)

    # Completing again keeps the original completion time.
    await update(session, ws, task, now=later(2), completed=True)
    saved = await stored(session, task.id)
    assert saved.completed_at == later(1)

    await update(session, ws, task, now=later(3), completed=False)
    saved = await stored(session, task.id)
    assert saved.completed_at is None
    assert saved.updated_at == later(3)


async def test_empty_update_changes_nothing(session: AsyncSession, ws: uuid.UUID) -> None:
    task = await create(session, ws)

    await update(session, ws, task, now=later(9))

    assert (await stored(session, task.id)).updated_at == T0


async def test_update_position(session: AsyncSession, ws: uuid.UUID) -> None:
    first = await create(session, ws)
    second = await create(session, ws)

    await update(session, ws, second, position=0.5)

    assert await live_ids(session, ws) == [second.id, first.id]


# --- delete / restore -------------------------------------------------------


async def test_delete_is_soft_and_cascades_to_live_subtasks(
    session: AsyncSession, ws: uuid.UUID
) -> None:
    parent = await create(session, ws)
    sub = await create(session, ws, parent_id=str(parent.id))

    await service.delete_task(session, ws, parent.id, now=later(1))

    assert await live_ids(session, ws) == []
    assert (await stored(session, parent.id)).deleted_at == later(1)
    assert (await stored(session, sub.id)).deleted_at == later(1)


async def test_restore_brings_back_parent_with_subtasks_deleted_together(
    session: AsyncSession, ws: uuid.UUID
) -> None:
    parent = await create(session, ws)
    deleted_earlier = await create(session, ws, "earlier", parent_id=str(parent.id))
    deleted_together = await create(session, ws, "together", parent_id=str(parent.id))
    await service.delete_task(session, ws, deleted_earlier.id, now=later(1))
    await service.delete_task(session, ws, parent.id, now=later(2))

    restored = await service.restore_task(session, ws, parent.id, now=later(3))

    assert restored.id == parent.id
    assert restored.deleted_at is None
    assert set(await live_ids(session, ws)) == {parent.id, deleted_together.id}
    assert (await stored(session, deleted_earlier.id)).deleted_at == later(1)


async def test_restore_subtask(session: AsyncSession, ws: uuid.UUID) -> None:
    parent = await create(session, ws)
    sub = await create(session, ws, parent_id=str(parent.id))
    await service.delete_task(session, ws, sub.id, now=later(1))

    await service.restore_task(session, ws, sub.id, now=later(2))

    assert set(await live_ids(session, ws)) == {parent.id, sub.id}


async def test_restore_subtask_of_deleted_parent_conflicts(
    session: AsyncSession, ws: uuid.UUID
) -> None:
    parent = await create(session, ws)
    sub = await create(session, ws, parent_id=str(parent.id))
    await service.delete_task(session, ws, parent.id, now=later(1))

    with pytest.raises(ConflictError, match="parent"):
        await service.restore_task(session, ws, sub.id, now=later(2))


@pytest.mark.parametrize("case", ["missing", "live", "other-workspace"])
async def test_restore_only_deleted_tasks_of_the_workspace(
    session: AsyncSession, ws: uuid.UUID, other_ws: uuid.UUID, case: str
) -> None:
    if case == "missing":
        task_id = uuid.uuid4()
    elif case == "live":
        task_id = (await create(session, ws)).id
    else:
        foreign = await create(session, other_ws)
        await service.delete_task(session, other_ws, foreign.id, now=T0)
        task_id = foreign.id

    with pytest.raises(NotFoundError):
        await service.restore_task(session, ws, task_id)

    if case == "other-workspace":
        assert (await stored(session, task_id)).deleted_at == T0


async def test_delete_does_not_touch_other_workspaces(
    session: AsyncSession, ws: uuid.UUID, other_ws: uuid.UUID
) -> None:
    mine = await create(session, ws)
    theirs = await create(session, other_ws)

    await service.delete_task(session, ws, mine.id, now=later(1))

    assert await live_ids(session, other_ws) == [theirs.id]
    rows = (await session.scalars(select(Task.id).where(Task.deleted_at.is_(None)))).all()
    assert rows == [theirs.id]
