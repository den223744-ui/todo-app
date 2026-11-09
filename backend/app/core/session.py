"""Anonymous session middleware: binds every API request to a workspace."""

from collections.abc import Collection

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from app.core.config import Settings
from app.core.errors import SessionRequiredError, error_response
from app.core.time import utcnow
from app.services.demo import visitor_today
from app.services.workspaces import create_workspace, delete_workspace, find_workspace

# The client sends its local date, so the demo's "today" is the visitor's today.
LOCAL_DATE_HEADER = "X-Local-Date"

# Only these methods may start a new session. See WorkspaceSessionMiddleware.
SESSION_STARTING_METHODS = frozenset({"GET", "HEAD"})


class WorkspaceSessionMiddleware(BaseHTTPMiddleware):
    """Resolve the workspace from the session cookie, creating one on first visit.

    The workspace id is put on ``request.state.workspace_id``.

    Rules:
    - Only GET and HEAD create a workspace. A write without a valid cookie gets
      401 ``session_required``: a cross-site form POST arrives without the
      SameSite=Lax cookie, and creating a session there would let a foreign
      site overwrite the visitor's cookie and cut them off from their list.
    - OPTIONS is never bound to a session. CORS preflights are sent without
      credentials and the browser does not keep cookies set on them, so a
      workspace created there would be orphaned. The API has no OPTIONS handlers.
    - The cookie is set whenever a workspace was created, error responses
      included. If the handler raises, the new workspace is deleted again:
      a workspace never exists without a cookie pointing at it.

    Known limit, handled by the client: if a new visitor sends several first
    requests in parallel, each gets its own workspace and the browser keeps the
    cookie of whichever response arrives last. The server cannot link those
    requests to one visitor without trusting a client-chosen id, so the API
    client must let the first request finish before sending others.
    """

    def __init__(
        self,
        app: ASGIApp,
        *,
        settings: Settings,
        session_factory: async_sessionmaker[AsyncSession],
        exempt_paths: Collection[str],
    ) -> None:
        super().__init__(app)
        self._settings = settings
        self._session_factory = session_factory
        self._scoped_prefix = f"{settings.api_prefix}/"
        self._exempt_paths = frozenset(path.rstrip("/") for path in exempt_paths)

    def _needs_workspace(self, path: str) -> bool:
        # "/api/health/" must be exempt too: it only redirects to "/api/health".
        return path.startswith(self._scoped_prefix) and path.rstrip("/") not in self._exempt_paths

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method == "OPTIONS" or not self._needs_workspace(request.url.path):
            return await call_next(request)

        async with self._session_factory() as session:
            workspace = await find_workspace(
                session, request.cookies.get(self._settings.session_cookie_name)
            )
            created = workspace is None
            if workspace is None:
                if request.method not in SESSION_STARTING_METHODS:
                    return session_required_response()
                demo_day = (
                    visitor_today(request.headers.get(LOCAL_DATE_HEADER), utcnow().date())
                    if self._settings.seed_demo_data
                    else None
                )
                workspace = await create_workspace(session, demo_day=demo_day)
        request.state.workspace_id = workspace.id

        try:
            response = await call_next(request)
        except Exception:
            if created:
                async with self._session_factory() as session:
                    await delete_workspace(session, workspace.id)
            raise

        if created:
            response.set_cookie(
                self._settings.session_cookie_name,
                str(workspace.id),
                max_age=self._settings.session_cookie_max_age,
                path="/",
                httponly=True,
                secure=self._settings.session_cookie_secure,
                samesite="lax",
            )
        return response


def session_required_response() -> JSONResponse:
    # Built here rather than raised: exceptions from BaseHTTPMiddleware bypass
    # the app's exception handlers and would turn into a 500.
    error = SessionRequiredError("No valid session. Load the task list (GET) to start one.")
    return error_response(error.status_code, error.code, error.message)
