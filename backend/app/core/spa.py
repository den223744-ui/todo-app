"""Serve the built frontend from the API process: one service in production.

The frontend is a single-page app whose state lives in the query string, so
every non-API path that is not a file gets ``index.html``. Unknown API paths
keep their JSON 404. Vite puts content hashes into asset names, so assets are
cached for a year; ``index.html`` is always revalidated to pick up new builds.
"""

from pathlib import Path

from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

IMMUTABLE = "public, max-age=31536000, immutable"
REVALIDATE = "no-cache"


class SpaStaticFiles(StaticFiles):
    def __init__(self, directory: Path, api_prefix: str) -> None:
        super().__init__(directory=directory, html=True)
        self._api_prefix = api_prefix.strip("/") + "/"

    async def get_response(self, path: str, scope: Scope) -> Response:
        # Starlette passes an OS path: backslashes on Windows.
        url_path = path.replace("\\", "/")
        try:
            response = await super().get_response(path, scope)
        except HTTPException as error:
            if error.status_code != 404 or f"{url_path}/".startswith(self._api_prefix):
                raise
            response = await super().get_response("index.html", scope)
        immutable = url_path.startswith("assets/") and response.status_code == 200
        response.headers["Cache-Control"] = IMMUTABLE if immutable else REVALIDATE
        return response
