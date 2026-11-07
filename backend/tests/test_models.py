"""Database-level guarantees: defaults, CHECK constraints, foreign keys, UTC timestamps."""

import uuid
from datetime import UTC, date, datetime, time
from typing import Any

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, StatementError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Task, Workspace

pytestmark = pytest.mark.anyio


async def make_workspace(session: AsyncSession) -> Workspace:
    workspace = Workspace()
    session.add(workspace)
    await session.flush()
    return workspace


def make_task(workspace: Workspace, **overrides: Any) -> Task:
    fields: dict[str, Any] = {"workspace_id": workspace.id, "title": "Task", "position": 1.0}
    fields.update(overrides)
    return Task(**fields)


async def test_task_defaults(session: AsyncSession) -> None:
    workspace = await make_workspace(session)
    task = make_task(workspace)
    session.add(task)
    await session.commit()

    loaded = await session.get(Task, task.id, populate_existing=True)

    assert loaded is not None
    assert loaded.priority == 0
    assert loaded.tags == []
    assert loaded.parent_id is None
    assert loaded.completed_at is None
    assert loaded.deleted_at is None
    assert loaded.created_at.tzinfo is UTC
    assert loaded.updated_at.tzinfo is UTC


async def test_datetimes_round_trip_as_utc(session: AsyncSession) -> None:
    workspace = await make_workspace(session)
    completed = datetime(2026, 1, 2, 3, 4, 5, tzinfo=UTC)
    task = make_task(workspace, completed_at=completed, due_date=date(2026, 1, 3))
    session.add(task)
    await session.commit()

    loaded = await session.get(Task, task.id, populate_existing=True)

    assert loaded is not None
    assert loaded.completed_at == completed
    assert loaded.completed_at is not None
    assert loaded.completed_at.tzinfo is UTC


async def test_naive_datetime_is_rejected(session: AsyncSession) -> None:
    workspace = await make_workspace(session)
    session.add(make_task(workspace, completed_at=datetime(2026, 1, 2, 3, 4, 5)))

    with pytest.raises(StatementError, match="Naive datetimes"):
        await session.flush()


@pytest.mark.parametrize(
    "overrides",
    [
        pytest.param({"priority": 4}, id="priority-above-max"),
        pytest.param({"priority": -1}, id="priority-below-min"),
        pytest.param({"title": ""}, id="empty-title"),
        pytest.param({"due_time": time(18, 0)}, id="time-without-date"),
    ],
)
async def test_check_constraints(session: AsyncSession, overrides: dict[str, Any]) -> None:
    workspace = await make_workspace(session)
    session.add(make_task(workspace, **overrides))

    with pytest.raises(IntegrityError):
        await session.flush()


async def test_task_cannot_be_its_own_parent(session: AsyncSession) -> None:
    workspace = await make_workspace(session)
    task = make_task(workspace)
    session.add(task)
    await session.flush()

    task.parent_id = task.id
    with pytest.raises(IntegrityError):
        await session.flush()


async def test_unknown_workspace_is_rejected(session: AsyncSession) -> None:
    session.add(Task(workspace_id=uuid.uuid4(), title="Orphan", position=1.0))

    with pytest.raises(IntegrityError):
        await session.flush()


async def test_deleting_workspace_cascades_to_tasks(session: AsyncSession) -> None:
    workspace = await make_workspace(session)
    parent = make_task(workspace)
    session.add(parent)
    await session.flush()
    session.add(make_task(workspace, parent_id=parent.id))
    await session.commit()

    await session.delete(workspace)
    await session.commit()

    assert await session.scalar(select(func.count()).select_from(Task)) == 0
