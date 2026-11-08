"""Task API end to end: HTTP -> session -> service -> database."""

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient, Response

from app.core.config import Settings
from app.main import create_app

pytestmark = pytest.mark.anyio

TASKS = "/api/tasks"
READ_FIELDS = {
    "id",
    "parent_id",
    "title",
    "notes",
    "priority",
    "due_date",
    "due_time",
    "tags",
    "position",
    "completed_at",
    "created_at",
    "updated_at",
}


@pytest.fixture
async def app(database_url: str) -> AsyncIterator[FastAPI]:
    app = create_app(Settings(database_url=database_url))
    yield app
    await app.state.engine.dispose()


@asynccontextmanager
async def visitor(app: FastAPI) -> AsyncIterator[AsyncClient]:
    """A browser with its own cookie jar, after the first page load."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get(TASKS)).status_code == 200
        yield client


@pytest.fixture
async def alice(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with visitor(app) as client:
        yield client


@pytest.fixture
async def bob(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with visitor(app) as client:
        yield client


async def create(client: AsyncClient, title: str = "Task", **fields: Any) -> dict[str, Any]:
    response = await client.post(TASKS, json={"title": title, **fields})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


async def titles(client: AsyncClient) -> list[str]:
    response = await client.get(TASKS)
    assert response.status_code == 200
    return [task["title"] for task in response.json()]


def assert_error(response: Response, status: int, code: str) -> None:
    assert response.status_code == status, response.text
    assert response.json()["error"]["code"] == code


# --- list / create ----------------------------------------------------------


async def test_new_visitor_has_empty_list(app: FastAPI) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(TASKS)

    assert response.status_code == 200
    assert response.json() == []
    assert "todo_workspace" in response.cookies


async def test_create_returns_the_task(alice: AsyncClient) -> None:
    response = await alice.post(
        TASKS,
        json={
            "title": "  купить молоко ",
            "notes": "2 л",
            "priority": 3,
            "due_date": "2026-11-09",
            "due_time": "18:00:00",
            "tags": ["#Дом"],
        },
    )

    assert response.status_code == 201
    task = response.json()
    assert set(task) == READ_FIELDS
    uuid.UUID(task["id"])
    assert task["title"] == "купить молоко"
    assert task["notes"] == "2 л"
    assert task["priority"] == 3
    assert task["due_date"] == "2026-11-09"
    assert task["due_time"] == "18:00:00"
    assert task["tags"] == ["дом"]
    assert task["position"] == 1.0
    assert task["parent_id"] is None
    assert task["completed_at"] is None
    assert task["created_at"].endswith("Z") or task["created_at"].endswith("+00:00")


async def test_created_tasks_persist_and_are_listed_in_order(alice: AsyncClient) -> None:
    await create(alice, "first")
    await create(alice, "second")
    await create(alice, "zero", position=0.5)

    assert await titles(alice) == ["zero", "first", "second"]


async def test_list_is_flat_with_subtasks(alice: AsyncClient) -> None:
    parent = await create(alice, "parent")
    sub = await create(alice, "sub", parent_id=parent["id"])

    tasks = (await alice.get(TASKS)).json()

    by_id = {task["id"]: task for task in tasks}
    assert set(by_id) == {parent["id"], sub["id"]}
    assert by_id[sub["id"]]["parent_id"] == parent["id"]


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({}, id="no-title"),
        pytest.param({"title": " "}, id="blank-title"),
        pytest.param({"title": "x" * 501}, id="long-title"),
        pytest.param({"title": "t", "priority": 4}, id="bad-priority"),
        pytest.param({"title": "t", "due_time": "18:00"}, id="time-without-date"),
        pytest.param({"title": "t", "due_date": "2026-02-31"}, id="impossible-date"),
        pytest.param({"title": "t", "workspace_id": str(uuid.uuid4())}, id="unknown-field"),
        pytest.param({"title": "t", "tags": "дом"}, id="tags-not-a-list"),
    ],
)
async def test_create_validation(alice: AsyncClient, payload: dict[str, Any]) -> None:
    response = await alice.post(TASKS, json=payload)

    assert_error(response, 422, "validation_error")
    assert await titles(alice) == []


async def test_subtask_of_subtask_is_rejected(alice: AsyncClient) -> None:
    parent = await create(alice, "parent")
    sub = await create(alice, "sub", parent_id=parent["id"])

    response = await alice.post(TASKS, json={"title": "deep", "parent_id": sub["id"]})

    assert_error(response, 422, "validation_error")


async def test_unknown_parent_is_not_found(alice: AsyncClient) -> None:
    response = await alice.post(TASKS, json={"title": "t", "parent_id": str(uuid.uuid4())})

    assert_error(response, 404, "not_found")


# --- update -----------------------------------------------------------------


async def test_patch_updates_only_sent_fields(alice: AsyncClient) -> None:
    task = await create(alice, "old", notes="keep", priority=1)

    response = await alice.patch(f"{TASKS}/{task['id']}", json={"title": "new", "tags": ["A"]})

    assert response.status_code == 200
    updated = response.json()
    assert updated["title"] == "new"
    assert updated["tags"] == ["a"]
    assert updated["notes"] == "keep"
    assert updated["priority"] == 1
    assert updated["created_at"] == task["created_at"]
    assert updated["updated_at"] >= task["updated_at"]


async def test_patch_complete_and_reopen(alice: AsyncClient) -> None:
    task = await create(alice)
    url = f"{TASKS}/{task['id']}"

    completed = (await alice.patch(url, json={"completed": True})).json()
    assert completed["completed_at"] is not None

    reopened = (await alice.patch(url, json={"completed": False})).json()
    assert reopened["completed_at"] is None


async def test_patch_position_reorders(alice: AsyncClient) -> None:
    await create(alice, "a")
    b = await create(alice, "b")

    await alice.patch(f"{TASKS}/{b['id']}", json={"position": 0.5})

    assert await titles(alice) == ["b", "a"]


async def test_patch_clears_nullable_fields(alice: AsyncClient) -> None:
    task = await create(alice, notes="n", due_date="2026-11-09", due_time="10:00")

    updated = (
        await alice.patch(f"{TASKS}/{task['id']}", json={"notes": None, "due_date": None})
    ).json()

    assert (updated["notes"], updated["due_date"], updated["due_time"]) == (None, None, None)


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({"title": None}, id="null-title"),
        pytest.param({"priority": 7}, id="bad-priority"),
        pytest.param({"due_time": "10:00"}, id="time-without-date"),
        pytest.param({"parent_id": None}, id="parent-not-updatable"),
        pytest.param({"completed_at": "2026-01-01T00:00:00Z"}, id="server-owned"),
    ],
)
async def test_patch_validation(alice: AsyncClient, payload: dict[str, Any]) -> None:
    task = await create(alice, "unchanged")

    response = await alice.patch(f"{TASKS}/{task['id']}", json=payload)

    assert_error(response, 422, "validation_error")
    assert await titles(alice) == ["unchanged"]


async def test_malformed_task_id(alice: AsyncClient) -> None:
    response = await alice.patch(f"{TASKS}/not-a-uuid", json={"title": "x"})

    assert_error(response, 422, "validation_error")


# --- delete / restore -------------------------------------------------------


async def test_delete_and_restore_with_subtasks(alice: AsyncClient) -> None:
    parent = await create(alice, "parent")
    await create(alice, "sub", parent_id=parent["id"])
    url = f"{TASKS}/{parent['id']}"

    deleted = await alice.delete(url)
    assert deleted.status_code == 204
    assert deleted.content == b""
    assert await titles(alice) == []

    restored = await alice.post(f"{url}/restore")
    assert restored.status_code == 200
    assert restored.json()["id"] == parent["id"]
    assert sorted(await titles(alice)) == ["parent", "sub"]


async def test_deleted_task_cannot_be_updated_or_deleted_again(alice: AsyncClient) -> None:
    task = await create(alice)
    url = f"{TASKS}/{task['id']}"
    await alice.delete(url)

    assert_error(await alice.patch(url, json={"title": "x"}), 404, "not_found")
    assert_error(await alice.delete(url), 404, "not_found")


async def test_restore_of_live_task_is_not_found(alice: AsyncClient) -> None:
    task = await create(alice)

    assert_error(await alice.post(f"{TASKS}/{task['id']}/restore"), 404, "not_found")


async def test_restore_subtask_of_deleted_parent_conflicts(alice: AsyncClient) -> None:
    parent = await create(alice, "parent")
    sub = await create(alice, "sub", parent_id=parent["id"])
    await alice.delete(f"{TASKS}/{parent['id']}")

    assert_error(await alice.post(f"{TASKS}/{sub['id']}/restore"), 409, "conflict")


@pytest.mark.parametrize(
    ("method", "suffix"),
    [("PATCH", ""), ("DELETE", ""), ("POST", "/restore")],
)
async def test_unknown_task_is_not_found(alice: AsyncClient, method: str, suffix: str) -> None:
    response = await alice.request(
        method,
        f"{TASKS}/{uuid.uuid4()}{suffix}",
        json={"title": "x"} if method == "PATCH" else None,
    )

    assert_error(response, 404, "not_found")


# --- workspace isolation ----------------------------------------------------


async def test_visitors_see_only_their_own_tasks(alice: AsyncClient, bob: AsyncClient) -> None:
    await create(alice, "alice's")
    await create(bob, "bob's")

    assert await titles(alice) == ["alice's"]
    assert await titles(bob) == ["bob's"]


@pytest.mark.parametrize(
    ("method", "suffix", "body"),
    [
        pytest.param("PATCH", "", {"title": "hacked"}, id="update"),
        pytest.param("PATCH", "", {"completed": True}, id="complete"),
        pytest.param("DELETE", "", None, id="delete"),
    ],
)
async def test_foreign_task_is_404_and_untouched(
    alice: AsyncClient, bob: AsyncClient, method: str, suffix: str, body: Any
) -> None:
    task = await create(alice, "alice's")

    response = await bob.request(method, f"{TASKS}/{task['id']}{suffix}", json=body)

    assert_error(response, 404, "not_found")
    tasks = (await alice.get(TASKS)).json()
    assert [(t["title"], t["completed_at"]) for t in tasks] == [("alice's", None)]


async def test_foreign_deleted_task_cannot_be_restored(
    alice: AsyncClient, bob: AsyncClient
) -> None:
    task = await create(alice, "alice's")
    await alice.delete(f"{TASKS}/{task['id']}")

    assert_error(await bob.post(f"{TASKS}/{task['id']}/restore"), 404, "not_found")
    assert await titles(bob) == []
    assert await titles(alice) == []


async def test_foreign_task_cannot_be_used_as_parent(alice: AsyncClient, bob: AsyncClient) -> None:
    task = await create(alice, "alice's")

    response = await bob.post(TASKS, json={"title": "sneaky", "parent_id": task["id"]})

    assert_error(response, 404, "not_found")
    assert await titles(bob) == []


async def test_isolation_errors_match_missing_task_errors(
    alice: AsyncClient, bob: AsyncClient
) -> None:
    # A foreign id and a random id must look identical: nothing to probe.
    task = await create(alice)

    foreign = await bob.patch(f"{TASKS}/{task['id']}", json={"title": "x"})
    missing = await bob.patch(f"{TASKS}/{uuid.uuid4()}", json={"title": "x"})

    assert foreign.status_code == missing.status_code == 404
    assert foreign.json() == missing.json()


# --- session ----------------------------------------------------------------


async def test_writes_need_a_session(app: FastAPI) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(TASKS, json={"title": "t"})

    assert_error(response, 401, "session_required")
