"""Migrations must build exactly the schema the models describe, and be reversible."""

from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import CheckConstraint, Engine, create_engine, inspect

from app.models import Base
from tests.alembic_utils import make_alembic_config


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    return tmp_path / "migrations.db"


@pytest.fixture
def alembic_config(db_path: Path) -> Config:
    return make_alembic_config(f"sqlite+aiosqlite:///{db_path.as_posix()}")


@pytest.fixture
def sync_engine(db_path: Path) -> Iterator[Engine]:
    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    yield engine
    engine.dispose()


def test_upgrade_matches_models(alembic_config: Config, sync_engine: Engine) -> None:
    command.upgrade(alembic_config, "head")

    with sync_engine.connect() as connection:
        context = MigrationContext.configure(connection, opts={"compare_type": True})
        diff = compare_metadata(context, Base.metadata)

    assert diff == []


@pytest.mark.parametrize("table", sorted(Base.metadata.tables))
def test_upgrade_creates_model_check_constraints(
    alembic_config: Config, sync_engine: Engine, table: str
) -> None:
    # Alembic autogenerate does not compare CHECK constraints, so do it explicitly.
    command.upgrade(alembic_config, "head")
    expected = {
        str(constraint.name): str(constraint.sqltext)
        for constraint in Base.metadata.tables[table].constraints
        if isinstance(constraint, CheckConstraint)
    }

    actual = {
        str(constraint["name"]): constraint["sqltext"]
        for constraint in inspect(sync_engine).get_check_constraints(table)
    }

    assert actual == expected


def test_downgrade_and_upgrade_again(alembic_config: Config, sync_engine: Engine) -> None:
    command.upgrade(alembic_config, "head")
    assert {"workspaces", "tasks"} <= set(inspect(sync_engine).get_table_names())

    command.downgrade(alembic_config, "base")
    assert set(inspect(sync_engine).get_table_names()) == {"alembic_version"}

    command.upgrade(alembic_config, "head")
    assert {"workspaces", "tasks"} <= set(inspect(sync_engine).get_table_names())
