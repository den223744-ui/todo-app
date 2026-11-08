"""Anonymous session: a workspace per visitor, carried by an httpOnly cookie."""

import uuid
from collections.abc import AsyncIterator
from http.cookies import SimpleCookie

import pytest
from fastapi import FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.requests import Request

from app.api.deps import WorkspaceId, get_workspace_id
from app.core.config import Settings
from app.main import create_app
from app.models import Workspace

pytestmark = pytest.mark.anyio

COOKIE = "todo_workspace"


def build_app(database_url: str, **overrides: object) -> FastAPI:
    app = create_app(Settings(database_url=database_url, **overrides))  # type: ignore[arg-type]

    @app.get("/api/_test/whoami")
    async def whoami(workspace_id: WorkspaceId) -> dict[str, str]:
        return {"workspace_id": str(workspace_id)}

    @app.get("/api/_test/missing")
    async def missing(workspace_id: WorkspaceId) -> None:
        raise HTTPException(status_code=404)

    return app


@pytest.fixture
async def app(database_url: str) -> AsyncIterator[FastAPI]:
    app = build_app(database_url)
    yield app
    await app.state.engine.dispose()


def new_client(app: FastAPI) -> AsyncClient:
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


@pytest.fixture
async def client(app: FastAPI) -> AsyncIterator[AsyncClient]:
    async with new_client(app) as client:
        yield client


def session_cookie(response: Response) -> SimpleCookie | None:
    header = response.headers.get("set-cookie")
    if header is None:
        return None
    cookie = SimpleCookie()
    cookie.load(header)
    return cookie


async def workspace_count(session: AsyncSession) -> int:
    return await session.scalar(select(func.count()).select_from(Workspace)) or 0


async def test_first_request_creates_workspace_and_sets_cookie(
    client: AsyncClient, session: AsyncSession
) -> None:
    response = await client.get("/api/_test/whoami")

    assert response.status_code == 200
    cookie = session_cookie(response)
    assert cookie is not None
    morsel = cookie[COOKIE]
    assert morsel.value == response.json()["workspace_id"]
    assert morsel["httponly"] is True
    assert morsel["samesite"] == "lax"
    assert morsel["path"] == "/"
    assert morsel["max-age"] == str(60 * 60 * 24 * 365)
    assert morsel["secure"] == ""
    assert await session.get(Workspace, uuid.UUID(morsel.value)) is not None


async def test_cookie_keeps_the_same_workspace(client: AsyncClient, session: AsyncSession) -> None:
    first = await client.get("/api/_test/whoami")
    second = await client.get("/api/_test/whoami")

    assert second.json() == first.json()
    assert session_cookie(second) is None
    assert await workspace_count(session) == 1


async def test_visitors_get_separate_workspaces(app: FastAPI, session: AsyncSession) -> None:
    async with new_client(app) as alice, new_client(app) as bob:
        alice_id = (await alice.get("/api/_test/whoami")).json()["workspace_id"]
        bob_id = (await bob.get("/api/_test/whoami")).json()["workspace_id"]

    assert alice_id != bob_id
    assert await workspace_count(session) == 2


@pytest.mark.parametrize(
    "bad_value",
    [
        pytest.param("not-a-uuid", id="malformed"),
        pytest.param(str(uuid.uuid4()), id="unknown-uuid"),
    ],
)
async def test_invalid_cookie_gets_a_new_server_generated_workspace(
    app: FastAPI, session: AsyncSession, bad_value: str
) -> None:
    async with new_client(app) as client:
        client.cookies.set(COOKIE, bad_value)
        response = await client.get("/api/_test/whoami")

    workspace_id = response.json()["workspace_id"]
    assert workspace_id != bad_value
    cookie = session_cookie(response)
    assert cookie is not None
    assert cookie[COOKIE].value == workspace_id
    assert await session.get(Workspace, uuid.UUID(workspace_id)) is not None


async def test_cookie_is_set_on_error_responses_too(
    client: AsyncClient, session: AsyncSession
) -> None:
    response = await client.get("/api/_test/missing")
    follow_up = await client.get("/api/_test/whoami")

    assert response.status_code == 404
    assert session_cookie(response) is not None
    assert session_cookie(follow_up) is None
    assert await workspace_count(session) == 1


@pytest.mark.parametrize("path", ["/api/health", "/api/openapi.json", "/api/docs", "/"])
async def test_exempt_paths_do_not_create_workspaces(
    client: AsyncClient, session: AsyncSession, path: str
) -> None:
    response = await client.get(path)

    assert session_cookie(response) is None
    assert await workspace_count(session) == 0


async def test_secure_flag_follows_settings(database_url: str) -> None:
    app = build_app(database_url, session_cookie_secure=True)
    async with new_client(app) as client:
        response = await client.get("/api/_test/whoami")
    await app.state.engine.dispose()

    cookie = session_cookie(response)
    assert cookie is not None
    assert cookie[COOKIE]["secure"] is True


def test_workspace_dependency_fails_loudly_without_middleware() -> None:
    # A route that needs a workspace on a path the middleware skips is a bug;
    # it must fail, not fall back to some shared workspace.
    request = Request({"type": "http", "path": "/api/health", "headers": []})

    with pytest.raises(RuntimeError, match="No workspace"):
        get_workspace_id(request)
