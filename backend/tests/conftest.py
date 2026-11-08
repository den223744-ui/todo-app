from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.config import Settings
from app.core.db import create_engine, create_session_factory
from app.main import create_app
from tests.alembic_utils import upgrade_to_head


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def database_url(tmp_path: Path) -> str:
    """A fresh SQLite file per test, migrated to head.

    The schema is built by the real Alembic migrations rather than
    ``metadata.create_all``, so tests exercise exactly what production runs
    (CHECK constraints included, which autogenerate comparison cannot see).
    """
    url = f"sqlite+aiosqlite:///{(tmp_path / 'test.db').as_posix()}"
    upgrade_to_head(url)
    return url


@pytest.fixture
async def engine(database_url: str) -> AsyncIterator[AsyncEngine]:
    engine = create_engine(database_url)
    yield engine
    await engine.dispose()


@pytest.fixture
async def session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    async with create_session_factory(engine)() as session:
        yield session


@pytest.fixture
async def client(database_url: str) -> AsyncIterator[AsyncClient]:
    app = create_app(Settings(database_url=database_url))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
    await app.state.engine.dispose()
