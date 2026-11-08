from pathlib import Path

from alembic import command
from alembic.config import Config

BACKEND_DIR = Path(__file__).resolve().parents[1]


def make_alembic_config(database_url: str) -> Config:
    config = Config(BACKEND_DIR / "alembic.ini")
    config.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    config.set_main_option("sqlalchemy.url", database_url)
    # Keep pytest's logging setup intact.
    config.attributes["configure_logger"] = False
    return config


def upgrade_to_head(database_url: str) -> None:
    command.upgrade(make_alembic_config(database_url), "head")
