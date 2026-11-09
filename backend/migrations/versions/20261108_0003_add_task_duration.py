"""add task duration

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-08 23:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Batch mode: SQLite cannot add a CHECK constraint to an existing table in place.
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.add_column(sa.Column("duration_minutes", sa.Integer(), nullable=True))
        batch_op.create_check_constraint(
            "duration_range",
            "duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440",
        )


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_constraint("duration_range", type_="check")
        batch_op.drop_column("duration_minutes")
