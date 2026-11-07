"""Migrations must build exactly the schema the models describe, and be reversible."""

from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import create_engine, inspect

from app.models import Base

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "migrations.db"


@pytest.fixture
def alembic_config(db_path: Path) -> Config:
    config = Config(BACKEND_DIR / "alembic.ini")
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.set_main_option("sqlalchemy.url", f"sqlite+aiosqlite:///{db_path.as_posix()}")
    config.attributes["configure_logger"] = False
    return config


def table_names(db_path: Path) -> set[str]:
    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    try:
        return set(inspect(engine).get_table_names())
    finally:
        engine.dispose()


def test_upgrade_matches_models(alembic_config: Config, db_path: Path) -> None:
    command.upgrade(alembic_config, "head")

    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    try:
        with engine.connect() as connection:
            context = MigrationContext.configure(connection, opts={"compare_type": True})
            diff = compare_metadata(context, Base.metadata)
    finally:
        engine.dispose()

    assert diff == []


def test_downgrade_and_upgrade_again(alembic_config: Config, db_path: Path) -> None:
    command.upgrade(alembic_config, "head")
    assert {"workspaces", "tasks"} <= table_names(db_path)

    command.downgrade(alembic_config, "base")
    assert table_names(db_path) == {"alembic_version"}

    command.upgrade(alembic_config, "head")
    assert {"workspaces", "tasks"} <= table_names(db_path)
