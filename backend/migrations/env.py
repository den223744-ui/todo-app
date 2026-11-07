"""Alembic environment: runs migrations through the app's async engine setup."""

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import create_async_engine

from app.core.config import get_settings
from app.models import Base

config = context.config

if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    """An explicit URL (set by tests via Config.set_main_option) wins over settings."""
    return config.get_main_option("sqlalchemy.url") or get_settings().database_url


def configure_context(**kwargs: object) -> None:
    url = get_url()
    context.configure(
        target_metadata=target_metadata,
        # SQLite cannot ALTER most things in place; batch mode recreates the table.
        render_as_batch=url.startswith("sqlite"),
        compare_type=True,
        **kwargs,  # type: ignore[arg-type]
    )


def run_migrations_offline() -> None:
    configure_context(url=get_url(), literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    configure_context(connection=connection)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    engine = create_async_engine(get_url(), poolclass=pool.NullPool)
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await engine.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_async_migrations())
