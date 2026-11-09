"""The OpenAPI document is the contract the frontend types are generated from."""

from typing import Any

import pytest
from pydantic import BaseModel, ValidationError

from app.core.config import Settings
from app.main import create_app
from app.schemas.task import TaskUpdate
from app.schemas.task_list import TaskListUpdate

EXPECTED_OPERATIONS = {
    ("get", "/api/health"): ("getHealth", set()),
    ("get", "/api/tasks"): ("listTasks", set()),
    ("post", "/api/tasks"): ("createTask", {"401", "404", "422"}),
    ("patch", "/api/tasks/{task_id}"): ("updateTask", {"401", "404", "422"}),
    ("delete", "/api/tasks/{task_id}"): ("deleteTask", {"401", "404", "422"}),
    ("post", "/api/tasks/{task_id}/restore"): ("restoreTask", {"401", "404", "409", "422"}),
    ("get", "/api/lists"): ("listLists", set()),
    ("post", "/api/lists"): ("createList", {"401", "409", "422"}),
    ("patch", "/api/lists/{list_id}"): ("updateList", {"401", "404", "409", "422"}),
    ("delete", "/api/lists/{list_id}"): ("deleteList", {"401", "404", "422"}),
}


@pytest.fixture(scope="module")
def schema() -> dict[str, Any]:
    spec: dict[str, Any] = create_app(Settings(database_url="sqlite+aiosqlite://")).openapi()
    return spec


def operations(schema: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    return {
        (method, path): operation
        for path, methods in schema["paths"].items()
        for method, operation in methods.items()
    }


def test_operations_and_ids(schema: dict[str, Any]) -> None:
    found = {key: op["operationId"] for key, op in operations(schema).items()}

    assert found == {key: op_id for key, (op_id, _) in EXPECTED_OPERATIONS.items()}


def test_error_responses_use_the_api_error_shape(schema: dict[str, Any]) -> None:
    for key, operation in operations(schema).items():
        _, expected_errors = EXPECTED_OPERATIONS[key]
        errors = {status for status in operation["responses"] if status.startswith(("4", "5"))}
        assert errors == expected_errors, key
        for status in errors:
            content = operation["responses"][status]["content"]["application/json"]
            assert content["schema"] == {"$ref": "#/components/schemas/ErrorResponse"}, key


def test_framework_validation_schema_is_not_exposed(schema: dict[str, Any]) -> None:
    # The API never returns FastAPI's {"detail": [...]} shape.
    assert "HTTPValidationError" not in schema["components"]["schemas"]
    assert "ValidationError" not in schema["components"]["schemas"]


@pytest.mark.parametrize("name", ["TaskRead", "TaskListRead"])
def test_read_fields_are_all_required(schema: dict[str, Any], name: str) -> None:
    # Required (even when nullable) means non-optional properties in TypeScript.
    read = schema["components"]["schemas"][name]

    assert set(read["required"]) == set(read["properties"])


def test_inputs_reject_unknown_fields(schema: dict[str, Any]) -> None:
    for name in ("TaskCreate", "TaskUpdate", "TaskListCreate", "TaskListUpdate"):
        assert schema["components"]["schemas"][name]["additionalProperties"] is False


@pytest.mark.parametrize(
    ("name", "model", "expected_nullable"),
    [
        (
            "TaskUpdate",
            TaskUpdate,
            {"notes", "due_date", "due_time", "duration_minutes", "list_id"},
        ),
        ("TaskListUpdate", TaskListUpdate, set()),
    ],
)
def test_update_schema_nullability_matches_validation(
    schema: dict[str, Any], name: str, model: type[BaseModel], expected_nullable: set[str]
) -> None:
    # The generated TS type must allow null exactly where the server accepts it.
    properties = schema["components"]["schemas"][name]["properties"]

    for field, prop in properties.items():
        schema_allows_null = {"type": "null"} in prop.get("anyOf", [])
        try:
            model.model_validate({field: None})
            server_accepts_null = True
        except ValidationError:
            server_accepts_null = False
        assert schema_allows_null == server_accepts_null, field

    nullable = {field for field, prop in properties.items() if "anyOf" in prop}
    assert nullable == expected_nullable
