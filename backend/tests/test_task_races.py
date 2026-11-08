"""Concurrency: a subtask must never stay live under a deleted parent.

The window between "parent is alive" and "write the subtask" is widened by
making one session sleep right after it reads the parent, while another session
deletes that parent. The service must serialize the two (row lock on
PostgreSQL, BEGIN IMMEDIATE on SQLite).

Runs on SQLite always and on PostgreSQL when TEST_POSTGRES_URL is set, e.g.
TEST_POSTGRES_URL=postgresql://postgres:pw@localhost:5432/postgres
"""

import asyncio
import contextlib
import os
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

import pytest
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import aliased

from app.core.config import normalize_database_url
from app.core.db import create_engine, create_session_factory
from app.core.errors import ConflictError, NotFoundError
from app.models import Task, Workspace
from app.schemas.task import TaskCreate
from app.services import tasks as service
from app.services.workspaces import create_workspace
from tests.alembic_utils import upgrade_to_head

pytestmark = pytest.mark.anyio

SLOW = 0.3
POSTGRES_URL = os.environ.get("TEST_POSTGRES_URL")


@pytest.fixture(
    params=[
        "sqlite",
        pytest.param(
            "postgres",
            marks=pytest.mark.skipif(not POSTGRES_URL, reason="TEST_POSTGRES_URL not set"),
        ),
    ]
)
def race_database_url(request: pytest.FixtureRequest, database_url: str) -> str:
    if request.param == "sqlite":
        return database_url
    assert POSTGRES_URL is not None
    url = normalize_database_url(POSTGRES_URL)
    upgrade_to_head(url)
    return url


@pytest.fixture
async def factory(race_database_url: str) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    engine: AsyncEngine = create_engine(race_database_url)
    yield create_session_factory(engine)
    if engine.dialect.name == "postgresql":
        async with engine.begin() as connection:
            await connection.execute(delete(Task))
            await connection.execute(delete(Workspace))
    await engine.dispose()


@pytest.fixture
def slow_session(monkeypatch: pytest.MonkeyPatch) -> Callable[[AsyncSession], None]:
    """Make the given session pause right after it has read a task."""
    slow: set[int] = set()
    original = service.get_task

    async def get_task(session: AsyncSession, *args: Any, **kwargs: Any) -> Task:
        task = await original(session, *args, **kwargs)
        if id(session) in slow:
            await asyncio.sleep(SLOW)
        return task

    monkeypatch.setattr(service, "get_task", get_task)
    return lambda session: slow.add(id(session))


async def setup_parent(
    factory: async_sessionmaker[AsyncSession], *, with_deleted_subtask: bool = False
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID | None]:
    async with factory() as session:
        ws = (await create_workspace(session)).id
        parent = await service.create_task(session, ws, TaskCreate(title="parent"))
        sub_id = None
        if with_deleted_subtask:
            sub = await service.create_task(
                session, ws, TaskCreate(title="sub", parent_id=parent.id)
            )
            sub_id = sub.id
            await service.delete_task(session, ws, sub.id)
        return ws, parent.id, sub_id


async def delete_parent_soon(
    factory: async_sessionmaker[AsyncSession], ws: uuid.UUID, parent_id: uuid.UUID
) -> None:
    await asyncio.sleep(SLOW / 3)  # let the slow operation read the parent first
    async with factory() as session:
        await service.delete_task(session, ws, parent_id)


async def live_subtasks_of_deleted_parents(factory: async_sessionmaker[AsyncSession]) -> int:
    parent = aliased(Task)
    async with factory() as session:
        rows = await session.scalars(
            Task.__table__.select()
            .with_only_columns(Task.id)
            .join(parent, Task.parent_id == parent.id)
            .where(Task.deleted_at.is_(None), parent.deleted_at.is_not(None))
        )
        return len(rows.all())


async def run_race(
    factory: async_sessionmaker[AsyncSession],
    slow_session: Callable[[AsyncSession], None],
    slow_operation: Callable[[AsyncSession], Awaitable[object]],
    ws: uuid.UUID,
    parent_id: uuid.UUID,
    allowed_errors: tuple[type[Exception], ...],
) -> None:
    async def slow() -> None:
        async with factory() as session:
            slow_session(session)
            with contextlib.suppress(*allowed_errors):
                await slow_operation(session)

    await asyncio.gather(slow(), delete_parent_soon(factory, ws, parent_id))


async def test_create_subtask_vs_delete_parent(
    factory: async_sessionmaker[AsyncSession], slow_session: Callable[[AsyncSession], None]
) -> None:
    ws, parent_id, _ = await setup_parent(factory)

    await run_race(
        factory,
        slow_session,
        lambda s: service.create_task(s, ws, TaskCreate(title="sub", parent_id=parent_id)),
        ws,
        parent_id,
        allowed_errors=(NotFoundError,),
    )

    assert await live_subtasks_of_deleted_parents(factory) == 0


async def test_restore_subtask_vs_delete_parent(
    factory: async_sessionmaker[AsyncSession], slow_session: Callable[[AsyncSession], None]
) -> None:
    ws, parent_id, sub_id = await setup_parent(factory, with_deleted_subtask=True)
    assert sub_id is not None

    await run_race(
        factory,
        slow_session,
        lambda s: service.restore_task(s, ws, sub_id),
        ws,
        parent_id,
        allowed_errors=(ConflictError,),
    )

    assert await live_subtasks_of_deleted_parents(factory) == 0
