"""Every error leaves the API as {"error": {"code", "message"}}."""

from collections.abc import AsyncIterator
from typing import Any

import pytest
from fastapi import FastAPI, HTTPException, Query
from httpx import ASGITransport, AsyncClient
from pydantic import BaseModel, Field

from app.api.deps import WorkspaceId
from app.core.config import Settings
from app.core.errors import AppError, NotFoundError, format_validation_errors
from app.main import create_app

pytestmark = pytest.mark.anyio

SECRET = "db password is hunter2"


class Payload(BaseModel):
    title: str = Field(min_length=1)
    priority: int


class TeapotError(AppError):
    status_code = 418
    code = "teapot"


@pytest.fixture
async def client(database_url: str) -> AsyncIterator[AsyncClient]:
    app: FastAPI = create_app(Settings(database_url=database_url))

    @app.get("/api/_test/not-found", include_in_schema=False)
    async def not_found(workspace_id: WorkspaceId) -> None:
        raise NotFoundError("Task not found")

    @app.get("/api/_test/custom", include_in_schema=False)
    async def custom(workspace_id: WorkspaceId) -> None:
        raise TeapotError("I am a teapot")

    @app.get("/api/_test/http/{status}", include_in_schema=False)
    async def http_error(status: int, workspace_id: WorkspaceId) -> None:
        raise HTTPException(status_code=status, detail={"not": "a string"})

    @app.get("/api/_test/http-detail", include_in_schema=False)
    async def http_detail(workspace_id: WorkspaceId) -> None:
        raise HTTPException(status_code=409, detail="Already done")

    @app.post("/api/_test/validate", include_in_schema=False)
    async def validate(
        payload: Payload, workspace_id: WorkspaceId, limit: int = Query()
    ) -> dict[str, Any]:
        return payload.model_dump()

    @app.get("/api/_test/crash", include_in_schema=False)
    async def crash(workspace_id: WorkspaceId) -> None:
        raise RuntimeError(SECRET)

    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Writes need an established session (see test_session.py).
        await client.get("/api/_test/custom")
        yield client
    await app.state.engine.dispose()


def error_of(body: Any) -> dict[str, str]:
    assert set(body) == {"error"}
    assert set(body["error"]) == {"code", "message"}
    assert all(isinstance(value, str) for value in body["error"].values())
    return dict(body["error"])


async def test_not_found_error(client: AsyncClient) -> None:
    response = await client.get("/api/_test/not-found")

    assert response.status_code == 404
    assert response.headers["content-type"] == "application/json"
    assert error_of(response.json()) == {"code": "not_found", "message": "Task not found"}


async def test_app_error_subclass_defines_status_and_code(client: AsyncClient) -> None:
    response = await client.get("/api/_test/custom")

    assert response.status_code == 418
    assert error_of(response.json()) == {"code": "teapot", "message": "I am a teapot"}


async def test_unknown_api_route(client: AsyncClient) -> None:
    response = await client.get("/api/does-not-exist")

    assert response.status_code == 404
    assert error_of(response.json()) == {"code": "not_found", "message": "Not Found"}


async def test_unknown_route_outside_api(client: AsyncClient) -> None:
    response = await client.get("/nope")

    assert response.status_code == 404
    assert error_of(response.json())["code"] == "not_found"


async def test_method_not_allowed_keeps_allow_header(client: AsyncClient) -> None:
    response = await client.delete("/api/health")

    assert response.status_code == 405
    assert response.headers["allow"] == "GET"
    assert error_of(response.json()) == {
        "code": "method_not_allowed",
        "message": "Method Not Allowed",
    }


async def test_http_exception_with_string_detail(client: AsyncClient) -> None:
    response = await client.get("/api/_test/http-detail")

    assert response.status_code == 409
    assert error_of(response.json()) == {"code": "conflict", "message": "Already done"}


@pytest.mark.parametrize(
    ("status", "code", "message"),
    [
        (400, "bad_request", "Bad Request"),
        (403, "forbidden", "Forbidden"),
        (429, "too_many_requests", "Too Many Requests"),
        (418, "http_error", "I'm a Teapot"),
    ],
)
async def test_http_exception_without_string_detail(
    client: AsyncClient, status: int, code: str, message: str
) -> None:
    response = await client.get(f"/api/_test/http/{status}")

    assert response.status_code == status
    assert error_of(response.json()) == {"code": code, "message": message}


async def test_validation_error_lists_every_field(client: AsyncClient) -> None:
    response = await client.post(
        "/api/_test/validate?limit=abc", json={"title": "", "priority": "secret-value"}
    )

    assert response.status_code == 422
    error = error_of(response.json())
    assert error["code"] == "validation_error"
    assert "query.limit: Input should be a valid integer" in error["message"]
    assert "body.title: String should have at least 1 character" in error["message"]
    assert "body.priority: Input should be a valid integer" in error["message"]
    # The submitted values are not echoed back.
    assert "secret-value" not in response.text


async def test_malformed_json_is_a_validation_error(client: AsyncClient) -> None:
    response = await client.post(
        "/api/_test/validate?limit=1",
        content=b"{not json",
        headers={"content-type": "application/json"},
    )

    assert response.status_code == 422
    error = error_of(response.json())
    assert error["code"] == "validation_error"
    assert "JSON decode error" in error["message"]


async def test_unhandled_error_is_logged_but_not_leaked(
    client: AsyncClient, caplog: pytest.LogCaptureFixture
) -> None:
    response = await client.get("/api/_test/crash")

    assert response.status_code == 500
    assert error_of(response.json()) == {
        "code": "internal_error",
        "message": "Internal server error",
    }
    assert SECRET not in response.text
    assert any(SECRET in str(record.exc_info) for record in caplog.records)


async def test_session_required_uses_the_same_format(database_url: str) -> None:
    app = create_app(Settings(database_url=database_url))
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/anything")
    await app.state.engine.dispose()

    assert response.status_code == 401
    assert error_of(response.json())["code"] == "session_required"


@pytest.mark.parametrize(
    ("errors", "expected"),
    [
        ([], "Invalid request"),
        ([{"loc": (), "msg": "Bad"}], "Bad"),
        ([{"loc": ("body", 0, "title")}], "body.0.title: Invalid value"),
        (
            [{"loc": ("query", "a"), "msg": "X"}, {"loc": ("body",), "msg": "Y"}],
            "query.a: X; body: Y",
        ),
    ],
)
def test_format_validation_errors(errors: list[dict[str, Any]], expected: str) -> None:
    assert format_validation_errors(errors) == expected
