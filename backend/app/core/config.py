"""Application settings read from the environment (and an optional .env file)."""

from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url

ASYNC_DRIVERS = {
    "postgres": "postgresql+asyncpg",
    "postgresql": "postgresql+asyncpg",
    "sqlite": "sqlite+aiosqlite",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Todo App"
    api_prefix: str = "/api"
    database_url: str = "sqlite+aiosqlite:///./todo.db"
    database_echo: bool = False

    # Anonymous session cookie that carries the workspace id.
    session_cookie_name: str = "todo_workspace"
    session_cookie_max_age: int = 60 * 60 * 24 * 365  # one year, in seconds
    # Must be true in production (HTTPS); false lets the cookie work on http://localhost.
    session_cookie_secure: bool = False

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        return normalize_database_url(value)


def normalize_database_url(raw_url: str) -> str:
    """Turn a URL from a hosting provider into one the async engine can use.

    Providers (Render, Neon) hand out libpq-style URLs: a sync scheme plus libpq
    query parameters. asyncpg receives URL query parameters as keyword arguments
    of ``asyncpg.connect()``, which knows ``ssl`` but not ``sslmode`` or
    ``channel_binding``.
    """
    url = make_url(raw_url)
    url = url.set(drivername=ASYNC_DRIVERS.get(url.drivername, url.drivername))

    if url.drivername == "postgresql+asyncpg":
        query = dict(url.query)
        sslmode = query.pop("sslmode", None)
        if sslmode is not None:
            # asyncpg accepts the same mode names: disable ... require ... verify-full.
            query.setdefault("ssl", sslmode)
        # Not supported by asyncpg. TLS is still enforced through ``ssl``.
        query.pop("channel_binding", None)
        url = url.set(query=query)

    return url.render_as_string(hide_password=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()
