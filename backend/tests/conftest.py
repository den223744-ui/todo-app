from collections.abc import AsyncIterator
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession

from app.core.config import Settings
from app.core.db import create_engine, create_session_factory
from app.main import create_app
from app.models import Base


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


@pytest.fixture
def database_url(tmp_path: Path) -> str:
    """A fresh SQLite file per test: full isolation, no shared state between tests."""
    return f"sqlite+aiosqlite:///{(tmp_path / 'test.db').as_posix()}"


@pytest.fixture
async def engine(database_url: str) -> AsyncIterator[AsyncEngine]:
    engine = create_engine(database_url)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture
async def session(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    async with create_session_factory(engine)() as session:
        yield session


@pytest.fixture
async def client(database_url: str, engine: AsyncEngine) -> AsyncIterator[AsyncClient]:
    # Depends on `engine` so that the schema exists before the app touches the database.
    app = create_app(Settings(database_url=database_url))
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
    await app.state.engine.dispose()
