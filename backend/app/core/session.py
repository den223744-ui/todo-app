"""Anonymous session middleware: binds every API request to a workspace."""

from collections.abc import Collection

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.types import ASGIApp

from app.core.config import Settings
from app.services.workspaces import get_or_create_workspace


class WorkspaceSessionMiddleware(BaseHTTPMiddleware):
    """Resolve the workspace from the session cookie, creating one on first visit.

    The workspace id is put on ``request.state.workspace_id``. The cookie is set
    on the response (error responses included) whenever a new workspace was
    created, so the browser keeps the same list from then on.
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
        self._exempt_paths = frozenset(exempt_paths)

    def _needs_workspace(self, path: str) -> bool:
        return path.startswith(self._scoped_prefix) and path not in self._exempt_paths

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if not self._needs_workspace(request.url.path):
            return await call_next(request)

        cookie_name = self._settings.session_cookie_name
        raw_id = request.cookies.get(cookie_name)
        async with self._session_factory() as session:
            workspace = await get_or_create_workspace(session, raw_id)
        request.state.workspace_id = workspace.id

        response = await call_next(request)
        if raw_id != str(workspace.id):
            response.set_cookie(
                cookie_name,
                str(workspace.id),
                max_age=self._settings.session_cookie_max_age,
                path="/",
                httponly=True,
                secure=self._settings.session_cookie_secure,
                samesite="lax",
            )
        return response
