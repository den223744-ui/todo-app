"""Lists API: CRUD, unique names, colours, tasks in lists, workspace isolation."""

import uuid
from collections.abc import AsyncIterator
from typing import Any, get_args

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.config import Settings
from app.main import create_app
from app.models.task_list import LIST_COLORS
from app.schemas.task_list import ListColor
from tests.test_tasks_api import TASKS, assert_error, create, visitor

pytestmark = pytest.mark.anyio

LISTS = "/api/lists"


@pytest.fixture
async def app(database_url: str) -> AsyncIterator[FastAPI]:
    app = create_app(Settings(database_url=database_url))
    yield app
    await app.state.engine.dispose()


@pytest.fixture
async def alice(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with visitor(app) as client:
        yield client


@pytest.fixture
async def bob(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with visitor(app) as client:
        yield client


async def create_list(client: AsyncClient, name: str = "Работа", **fields: Any) -> dict[str, Any]:
    response = await client.post(LISTS, json={"name": name, **fields})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


async def names(client: AsyncClient) -> list[str]:
    response = await client.get(LISTS)
    assert response.status_code == 200
    return [task_list["name"] for task_list in response.json()]


def test_color_literal_matches_the_model() -> None:
    assert get_args(ListColor) == LIST_COLORS


async def test_new_visitor_has_no_lists(app: FastAPI) -> None:
    async with visitor(app) as client:
        response = await client.get(LISTS)

    assert response.status_code == 200
    assert response.json() == []


async def test_create_returns_the_list(alice: AsyncClient) -> None:
    created = await create_list(alice, "  Работа ")

    assert set(created) == {"id", "name", "color", "position", "created_at", "updated_at"}
    uuid.UUID(created["id"])
    assert created["name"] == "Работа"
    assert created["color"] == "blue"
    assert created["position"] == 1.0


async def test_new_lists_take_colours_in_turn_and_go_last(alice: AsyncClient) -> None:
    created = [await create_list(alice, f"Список {i}") for i in range(len(LIST_COLORS) + 1)]

    assert [item["color"] for item in created] == [*LIST_COLORS, LIST_COLORS[0]]
    assert [item["position"] for item in created] == [float(i + 1) for i in range(len(created))]
    assert await names(alice) == [item["name"] for item in created]


async def test_create_with_colour_and_position(alice: AsyncClient) -> None:
    await create_list(alice, "Второй")
    first = await create_list(alice, "Первый", color="olive", position=0.5)

    assert first["color"] == "olive"
    assert await names(alice) == ["Первый", "Второй"]


async def test_names_are_unique_ignoring_case(alice: AsyncClient) -> None:
    await create_list(alice, "Работа")

    assert_error(await alice.post(LISTS, json={"name": "РАБОТА"}), 409, "conflict")


async def test_same_name_in_another_workspace_is_fine(alice: AsyncClient, bob: AsyncClient) -> None:
    await create_list(alice, "Работа")

    await create_list(bob, "Работа")


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"name": "   "},
        {"name": "x" * 101},
        {"name": "Ок", "color": "purple"},
        {"name": "Ок", "position": "inf"},
        {"name": "Ок", "workspace_id": str(uuid.uuid4())},
    ],
)
async def test_create_validation(alice: AsyncClient, payload: dict[str, Any]) -> None:
    assert_error(await alice.post(LISTS, json=payload), 422, "validation_error")


async def test_patch_renames_recolours_and_moves(alice: AsyncClient) -> None:
    work = await create_list(alice, "Работа")
    await create_list(alice, "Дом")

    response = await alice.patch(
        f"{LISTS}/{work['id']}", json={"name": "Офис", "color": "red", "position": 9}
    )

    assert response.status_code == 200, response.text
    assert response.json()["name"] == "Офис"
    assert response.json()["color"] == "red"
    assert await names(alice) == ["Дом", "Офис"]


async def test_patch_may_change_only_the_case_of_its_own_name(alice: AsyncClient) -> None:
    work = await create_list(alice, "работа")

    response = await alice.patch(f"{LISTS}/{work['id']}", json={"name": "Работа"})

    assert response.status_code == 200
    assert response.json()["name"] == "Работа"


async def test_patch_to_a_taken_name_conflicts(alice: AsyncClient) -> None:
    await create_list(alice, "Работа")
    home = await create_list(alice, "Дом")

    assert_error(
        await alice.patch(f"{LISTS}/{home['id']}", json={"name": "работа"}), 409, "conflict"
    )


@pytest.mark.parametrize("field", ["name", "color", "position"])
async def test_patch_rejects_null(alice: AsyncClient, field: str) -> None:
    work = await create_list(alice)

    response = await alice.patch(f"{LISTS}/{work['id']}", json={field: None})

    assert_error(response, 422, "validation_error")


async def test_delete_keeps_the_tasks_without_a_list(alice: AsyncClient) -> None:
    work = await create_list(alice)
    task = await create(alice, "Отчёт", list_id=work["id"])

    response = await alice.delete(f"{LISTS}/{work['id']}")

    assert response.status_code == 204
    assert await names(alice) == []
    (listed,) = (await alice.get(TASKS)).json()
    assert listed["id"] == task["id"]
    assert listed["list_id"] is None


async def test_delete_also_frees_deleted_tasks(alice: AsyncClient) -> None:
    work = await create_list(alice)
    task = await create(alice, "Отчёт", list_id=work["id"])
    await alice.delete(f"{TASKS}/{task['id']}")

    await alice.delete(f"{LISTS}/{work['id']}")
    restored = await alice.post(f"{TASKS}/{task['id']}/restore")

    assert restored.status_code == 200
    assert restored.json()["list_id"] is None


@pytest.mark.parametrize(("method", "body"), [("patch", {"name": "x"}), ("delete", None)])
async def test_unknown_list_is_not_found(
    alice: AsyncClient, method: str, body: dict[str, Any] | None
) -> None:
    response = await alice.request(method, f"{LISTS}/{uuid.uuid4()}", json=body)

    assert_error(response, 404, "not_found")


# --- tasks in lists -----------------------------------------------------------


async def test_task_is_created_in_a_list_and_moved_out(alice: AsyncClient) -> None:
    work = await create_list(alice, "Работа")
    home = await create_list(alice, "Дом")
    task = await create(alice, "Отчёт", list_id=work["id"])
    assert task["list_id"] == work["id"]

    moved = await alice.patch(f"{TASKS}/{task['id']}", json={"list_id": home["id"]})
    assert moved.json()["list_id"] == home["id"]

    cleared = await alice.patch(f"{TASKS}/{task['id']}", json={"list_id": None})
    assert cleared.json()["list_id"] is None


async def test_unknown_list_for_a_task_is_not_found(alice: AsyncClient) -> None:
    task = await create(alice)
    missing = str(uuid.uuid4())

    response = await alice.post(TASKS, json={"title": "x", "list_id": missing})
    assert_error(response, 404, "not_found")
    assert_error(
        await alice.patch(f"{TASKS}/{task['id']}", json={"list_id": missing}), 404, "not_found"
    )


async def test_subtasks_cannot_have_their_own_list(alice: AsyncClient) -> None:
    work = await create_list(alice)
    parent = await create(alice, "Родитель", list_id=work["id"])
    sub = await create(alice, "Подзадача", parent_id=parent["id"])

    response = await alice.post(
        TASKS, json={"title": "x", "parent_id": parent["id"], "list_id": work["id"]}
    )
    assert_error(response, 422, "validation_error")
    response = await alice.patch(f"{TASKS}/{sub['id']}", json={"list_id": work["id"]})
    assert_error(response, 422, "validation_error")
    # Clearing is harmless and allowed.
    cleared = await alice.patch(f"{TASKS}/{sub['id']}", json={"list_id": None})
    assert cleared.status_code == 200


# --- isolation ----------------------------------------------------------------


async def test_visitors_see_only_their_own_lists(alice: AsyncClient, bob: AsyncClient) -> None:
    await create_list(alice, "Работа")

    assert await names(bob) == []


@pytest.mark.parametrize(("method", "body"), [("patch", {"name": "Чужой"}), ("delete", None)])
async def test_foreign_list_is_404_and_untouched(
    alice: AsyncClient, bob: AsyncClient, method: str, body: dict[str, Any] | None
) -> None:
    work = await create_list(alice, "Работа")

    response = await bob.request(method, f"{LISTS}/{work['id']}", json=body)

    assert_error(response, 404, "not_found")
    assert await names(alice) == ["Работа"]


async def test_foreign_list_cannot_hold_my_task(alice: AsyncClient, bob: AsyncClient) -> None:
    work = await create_list(alice)
    task = await create(bob)

    assert_error(
        await bob.post(TASKS, json={"title": "x", "list_id": work["id"]}), 404, "not_found"
    )
    assert_error(
        await bob.patch(f"{TASKS}/{task['id']}", json={"list_id": work["id"]}), 404, "not_found"
    )


async def test_write_without_session_is_rejected(app: FastAPI) -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(LISTS, json={"name": "Работа"})

    assert_error(response, 401, "session_required")
