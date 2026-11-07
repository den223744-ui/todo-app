import pytest

from app.core.config import Settings


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ("postgres://u:p@host/db", "postgresql+asyncpg://u:p@host/db"),
        ("postgresql://u:p@host/db", "postgresql+asyncpg://u:p@host/db"),
        ("postgresql+asyncpg://u:p@host/db", "postgresql+asyncpg://u:p@host/db"),
        ("sqlite:///./todo.db", "sqlite+aiosqlite:///./todo.db"),
        ("sqlite+aiosqlite:///./todo.db", "sqlite+aiosqlite:///./todo.db"),
    ],
)
def test_database_url_uses_async_driver(given: str, expected: str) -> None:
    assert Settings(database_url=given).database_url == expected


def test_database_url_is_read_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://u:p@host/db")

    assert Settings().database_url == "postgresql+asyncpg://u:p@host/db"
