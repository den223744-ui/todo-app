"""Database engine and session factory."""

from collections.abc import AsyncIterator
from typing import Any

from fastapi import Request
from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)


def create_engine(database_url: str, *, echo: bool = False) -> AsyncEngine:
    engine = create_async_engine(database_url, echo=echo, pool_pre_ping=True)
    if engine.dialect.name == "sqlite":
        _configure_sqlite(engine)
    return engine


def _configure_sqlite(engine: AsyncEngine) -> None:
    """Make SQLite behave like the PostgreSQL we run in production, where it matters.

    - Foreign keys: SQLite ignores FOREIGN KEY constraints (and ON DELETE
      CASCADE) unless asked.
    - Locking: SQLite has no SELECT ... FOR UPDATE. Every transaction starts
      with BEGIN IMMEDIATE, taking the write lock up front, so check-then-write
      sequences (e.g. "parent is alive" -> "insert subtask") cannot interleave
      with another writer. The driver's own lazy BEGIN is switched off for this.
    """

    @event.listens_for(engine.sync_engine, "connect")
    def _on_connect(dbapi_connection: Any, _record: Any) -> None:
        dbapi_connection.isolation_level = None
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    @event.listens_for(engine.sync_engine, "begin")
    def _on_begin(connection: Any) -> None:
        connection.exec_driver_sql("BEGIN IMMEDIATE")


def create_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    # expire_on_commit=False keeps loaded attributes readable after commit:
    # async code cannot lazily reload them during response serialization.
    return async_sessionmaker(engine, expire_on_commit=False)


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """FastAPI dependency: one session per request."""
    session_factory: async_sessionmaker[AsyncSession] = request.app.state.session_factory
    async with session_factory() as session:
        yield session
