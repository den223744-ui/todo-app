"""Write the OpenAPI document to a file, without starting the server.

Usage: python -m app.openapi_export <output.json>

The frontend generates its API types from this file (``npm run gen:api``);
CI regenerates it and fails if the committed copy is out of date.
"""

import json
import sys
from pathlib import Path
from typing import Any

from app.core.config import Settings
from app.main import create_app


def build_openapi() -> dict[str, Any]:
    # The engine connects lazily, so no database is touched.
    schema: dict[str, Any] = create_app(Settings(database_url="sqlite+aiosqlite://")).openapi()
    return schema


def render(schema: dict[str, Any]) -> str:
    return json.dumps(schema, indent=2, ensure_ascii=False) + "\n"


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: python -m app.openapi_export <output.json>", file=sys.stderr)
        return 2
    Path(argv[1]).write_text(render(build_openapi()), encoding="utf-8", newline="\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
