# The demo content is Russian text; Cyrillic letters are not confusables here.
# ruff: noqa: RUF001
"""Demo content: a new visitor's workspace starts filled, around their own day."""

from collections.abc import AsyncIterator
from datetime import UTC, date, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings
from app.main import create_app
from app.models import Task, TaskList
from app.services.demo import DEMO_LISTS, DEMO_TASKS, seed_demo, visitor_today
from app.services.workspaces import create_workspace

pytestmark = pytest.mark.anyio

UTC_TODAY = date(2026, 11, 9)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("2026-11-09", UTC_TODAY),
        ("2026-11-10", date(2026, 11, 10)),  # east of UTC, already tomorrow
        ("2026-11-08", date(2026, 11, 8)),  # west of UTC, still yesterday
        ("2026-11-11", UTC_TODAY),  # more than a day off: ignored
        ("not-a-date", UTC_TODAY),
        ("", UTC_TODAY),
        (None, UTC_TODAY),
    ],
)
def test_visitor_today(raw: str | None, expected: date) -> None:
    assert visitor_today(raw, UTC_TODAY) == expected


async def test_seed_fills_lists_tasks_and_subtasks(session: AsyncSession) -> None:
    workspace = await create_workspace(session)
    now = datetime(2026, 11, 9, 12, tzinfo=UTC)
    await seed_demo(session, workspace.id, UTC_TODAY, now)

    lists = (await session.scalars(select(TaskList).order_by(TaskList.position))).all()
    assert [(item.name, item.color) for item in lists] == list(DEMO_LISTS)

    tasks = (await session.scalars(select(Task))).all()
    parents = [task for task in tasks if task.parent_id is None]
    subtasks = [task for task in tasks if task.parent_id is not None]
    assert len(parents) == len(DEMO_TASKS)
    assert len(subtasks) == sum(len(item.subtasks) for item in DEMO_TASKS)
    assert {task.workspace_id for task in tasks} == {workspace.id}
    # Subtasks follow their parent: no list of their own.
    assert all(task.list_id is None for task in subtasks)

    by_title = {task.title: task for task in parents}
    call = by_title["Созвон с командой по релизу"]
    assert call.due_date == UTC_TODAY
    assert call.due_time is not None
    assert call.list_id == next(item.id for item in lists if item.name == "Работа")
    assert by_title["Отправить отчёт за месяц"].due_date == UTC_TODAY - timedelta(days=2)
    assert by_title["Прочитать «Чистую архитектуру»"].due_date is None
    # Something is already done: today's progress and «Выполненные» are not empty.
    assert by_title["Утренняя пробежка"].completed_at == now
    assert by_title["Продлить подписку на облако"].completed_at == now - timedelta(days=3)
    assert by_title["Купить продукты"].completed_at is None


@pytest.fixture
async def demo_client(database_url: str) -> AsyncIterator[AsyncClient]:
    app = create_app(Settings(database_url=database_url, seed_demo_data=True))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
    await app.state.engine.dispose()


async def test_new_visitor_gets_the_demo_around_their_local_day(
    demo_client: AsyncClient,
) -> None:
    local = datetime.now(UTC).date() + timedelta(days=1)
    response = await demo_client.get("/api/tasks", headers={"X-Local-Date": local.isoformat()})
    assert response.status_code == 200
    tasks = response.json()
    assert len([task for task in tasks if task["parent_id"] is None]) == len(DEMO_TASKS)
    call = next(task for task in tasks if task["title"] == "Созвон с командой по релизу")
    assert call["due_date"] == local.isoformat()

    lists = (await demo_client.get("/api/lists")).json()
    assert [item["name"] for item in lists] == [name for name, _ in DEMO_LISTS]

    # The same visitor (cookie kept) is not seeded twice.
    again = (await demo_client.get("/api/tasks")).json()
    assert len(again) == len(tasks)


async def test_demo_is_off_by_default(client: AsyncClient, session: AsyncSession) -> None:
    assert (await client.get("/api/tasks")).json() == []
    assert await session.scalar(select(func.count(TaskList.id))) == 0
