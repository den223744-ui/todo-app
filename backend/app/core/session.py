"""Anonymous session middleware: binds every API request to a workspace."""

from collections.abc import Collection

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

from app.core.config import Settings
from app.core.errors import SessionRequiredError, error_response
from app.services.workspaces import create_workspace, delete_workspace, find_workspace

# Only these methods may start a new session. See WorkspaceSessionMiddleware.
SESSION_STARTING_METHODS = frozenset({"GET", "HEAD", "OPTIONS"})


class WorkspaceSessionMiddleware(BaseHTTPMiddleware):
    """Resolve the workspace from the session cookie, creating one on first visit.

    The workspace id is put on ``request.state.workspace_id``.

    Rules:
    - Only safe methods (GET, HEAD, OPTIONS) create a workspace. A write without
      a valid cookie gets 401 ``session_required``. Why:
      * a cross-site form POST arrives without the SameSite=Lax cookie; creating
        a session there would let a foreign site overwrite the visitor's cookie
        and cut them off from their list;
      * a write can never land in a workspace whose cookie the browser then
        replaces with a parallel response, so no data is lost.
    - The cookie is set whenever a workspace was created, error responses
      included. If the handler raises, the new workspace is deleted again:
      a workspace never exists without a cookie pointing at it.
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
        if not self._needs_workspace(request.url.path):
            return await call_next(request)

        async with self._session_factory() as session:
            workspace = await find_workspace(
                session, request.cookies.get(self._settings.session_cookie_name)
            )
            created = workspace is None
            if workspace is None:
                if request.method not in SESSION_STARTING_METHODS:
                    return session_required_response()
                workspace = await create_workspace(session)
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
