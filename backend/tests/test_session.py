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
WHOAMI = "/api/_test/whoami"


def build_app(database_url: str, **overrides: object) -> FastAPI:
    app = create_app(Settings(database_url=database_url, **overrides))  # type: ignore[arg-type]

    @app.api_route(WHOAMI, methods=["GET", "POST", "PATCH", "DELETE"], include_in_schema=False)
    async def whoami(workspace_id: WorkspaceId) -> dict[str, str]:
        return {"workspace_id": str(workspace_id)}

    @app.get("/api/_test/missing")
    async def missing(workspace_id: WorkspaceId) -> None:
        raise HTTPException(status_code=404)

    @app.get("/api/_test/crash")
    async def crash(workspace_id: WorkspaceId) -> None:
        raise RuntimeError("boom")

    return app


@pytest.fixture
async def app(database_url: str) -> AsyncIterator[FastAPI]:
    app = build_app(database_url)
    yield app
    await app.state.engine.dispose()


def new_client(app: FastAPI, *, raise_app_exceptions: bool = True) -> AsyncClient:
    transport = ASGITransport(app=app, raise_app_exceptions=raise_app_exceptions)
    return AsyncClient(transport=transport, base_url="http://test")


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
    response = await client.get(WHOAMI)

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
    first = await client.get(WHOAMI)
    second = await client.get(WHOAMI)

    assert second.json() == first.json()
    assert session_cookie(second) is None
    assert await workspace_count(session) == 1


async def test_visitors_get_separate_workspaces(app: FastAPI, session: AsyncSession) -> None:
    async with new_client(app) as alice, new_client(app) as bob:
        alice_id = (await alice.get(WHOAMI)).json()["workspace_id"]
        bob_id = (await bob.get(WHOAMI)).json()["workspace_id"]

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
        response = await client.get(WHOAMI)

    workspace_id = response.json()["workspace_id"]
    assert workspace_id != bad_value
    cookie = session_cookie(response)
    assert cookie is not None
    assert cookie[COOKIE].value == workspace_id
    assert await session.get(Workspace, uuid.UUID(workspace_id)) is not None


@pytest.mark.parametrize("method", ["POST", "PATCH", "DELETE"])
@pytest.mark.parametrize(
    "cookie_value",
    [
        pytest.param(None, id="no-cookie"),
        pytest.param("not-a-uuid", id="malformed"),
        pytest.param(str(uuid.uuid4()), id="unknown-uuid"),
    ],
)
async def test_write_without_valid_session_is_rejected(
    app: FastAPI, session: AsyncSession, method: str, cookie_value: str | None
) -> None:
    # This is also what a cross-site form POST looks like: SameSite=Lax keeps the
    # visitor's cookie off it. It must not issue a cookie that would replace theirs.
    async with new_client(app) as client:
        if cookie_value is not None:
            client.cookies.set(COOKIE, cookie_value)
        response = await client.request(method, WHOAMI)

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "session_required",
            "message": "No valid session. Load the task list (GET) to start one.",
        }
    }
    assert session_cookie(response) is None
    assert await workspace_count(session) == 0


@pytest.mark.parametrize("method", ["POST", "PATCH", "DELETE"])
async def test_write_with_session_uses_it(client: AsyncClient, method: str) -> None:
    workspace_id = (await client.get(WHOAMI)).json()["workspace_id"]

    response = await client.request(method, WHOAMI)

    assert response.status_code == 200
    assert response.json() == {"workspace_id": workspace_id}
    assert session_cookie(response) is None


async def test_parallel_first_visits_cannot_lose_writes(
    app: FastAPI, session: AsyncSession
) -> None:
    # Two first requests race without a cookie. Only the read may start a
    # session; the write is refused, so it cannot land in a workspace whose
    # cookie the browser later replaces.
    async with new_client(app) as tab_one, new_client(app) as tab_two:
        read = await tab_one.get(WHOAMI)
        write = await tab_two.post(WHOAMI)

    assert read.status_code == 200
    assert write.status_code == 401
    assert await workspace_count(session) == 1


async def test_cookie_is_set_on_handled_error_responses(
    client: AsyncClient, session: AsyncSession
) -> None:
    response = await client.get("/api/_test/missing")
    follow_up = await client.get(WHOAMI)

    assert response.status_code == 404
    assert session_cookie(response) is not None
    assert session_cookie(follow_up) is None
    assert await workspace_count(session) == 1


async def test_unhandled_error_leaves_no_orphan_workspace(
    app: FastAPI, session: AsyncSession
) -> None:
    async with new_client(app, raise_app_exceptions=False) as client:
        first = await client.get("/api/_test/crash")
        second = await client.get("/api/_test/crash")

    assert first.status_code == second.status_code == 500
    assert await workspace_count(session) == 0


async def test_unhandled_error_keeps_existing_workspace(
    app: FastAPI, session: AsyncSession
) -> None:
    async with new_client(app, raise_app_exceptions=False) as client:
        workspace_id = (await client.get(WHOAMI)).json()["workspace_id"]
        response = await client.get("/api/_test/crash")

    assert response.status_code == 500
    assert await session.get(Workspace, uuid.UUID(workspace_id)) is not None


@pytest.mark.parametrize(
    "path",
    [
        "/api/health",
        "/api/health/",
        "/api/openapi.json",
        "/api/openapi.json/",
        "/api/docs",
        "/api/docs/",
        "/",
    ],
)
async def test_exempt_paths_do_not_create_workspaces(
    client: AsyncClient, session: AsyncSession, path: str
) -> None:
    response = await client.get(path)

    assert session_cookie(response) is None
    assert await workspace_count(session) == 0


async def test_secure_flag_follows_settings(database_url: str) -> None:
    app = build_app(database_url, session_cookie_secure=True)
    async with new_client(app) as client:
        response = await client.get(WHOAMI)
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
