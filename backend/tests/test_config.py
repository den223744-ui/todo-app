import pytest
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import Settings, normalize_database_url

NEON_URL = (
    "postgresql://user:p%40ss@ep-cool-1.eu-central-1.aws.neon.tech/neondb"
    "?sslmode=require&channel_binding=require"
)


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ("postgres://u:p@host/db", "postgresql+asyncpg://u:p@host/db"),
        ("postgresql://u:p@host/db", "postgresql+asyncpg://u:p@host/db"),
        ("postgresql+asyncpg://u:p@host/db", "postgresql+asyncpg://u:p@host/db"),
        ("sqlite:///./todo.db", "sqlite+aiosqlite:///./todo.db"),
        ("sqlite+aiosqlite:///./todo.db", "sqlite+aiosqlite:///./todo.db"),
        (
            NEON_URL,
            "postgresql+asyncpg://user:p%40ss@ep-cool-1.eu-central-1.aws.neon.tech/neondb"
            "?ssl=require",
        ),
        (
            "postgresql://u:p@host/db?sslmode=verify-full",
            "postgresql+asyncpg://u:p@host/db?ssl=verify-full",
        ),
        # An explicit asyncpg option wins over the libpq one.
        (
            "postgresql://u:p@host/db?ssl=disable&sslmode=require",
            "postgresql+asyncpg://u:p@host/db?ssl=disable",
        ),
    ],
)
def test_normalize_database_url(given: str, expected: str) -> None:
    assert normalize_database_url(given) == expected


def test_neon_url_yields_only_asyncpg_connect_arguments() -> None:
    url = make_url(Settings(database_url=NEON_URL).database_url)
    engine = create_async_engine(url)

    _, connect_kwargs = engine.dialect.create_connect_args(url)

    assert connect_kwargs["ssl"] == "require"
    assert connect_kwargs["password"] == "p@ss"
    assert "sslmode" not in connect_kwargs
    assert "channel_binding" not in connect_kwargs


def test_database_url_is_read_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@host/db")

    assert Settings().database_url == "postgresql+asyncpg://u:p@host/db"
