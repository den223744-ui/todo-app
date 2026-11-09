"""add task lists

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-08 21:35:58.381060

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "task_lists",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("name_key", sa.String(length=100), nullable=False),
        sa.Column("color", sa.String(length=20), nullable=False),
        sa.Column("position", sa.Double(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "length(name) BETWEEN 1 AND 100", name=op.f("ck_task_lists_name_length")
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_task_lists_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_task_lists")),
        sa.UniqueConstraint("workspace_id", "name_key", name=op.f("uq_task_lists_workspace_id")),
    )
    # Batch mode: SQLite cannot add a foreign key to an existing table in place.
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.add_column(sa.Column("list_id", sa.Uuid(), nullable=True))
        batch_op.create_index(batch_op.f("ix_tasks_list_id"), ["list_id"], unique=False)
        batch_op.create_foreign_key(
            batch_op.f("fk_tasks_list_id_task_lists"),
            "task_lists",
            ["list_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    with op.batch_alter_table("tasks") as batch_op:
        batch_op.drop_constraint(batch_op.f("fk_tasks_list_id_task_lists"), type_="foreignkey")
        batch_op.drop_index(batch_op.f("ix_tasks_list_id"))
        batch_op.drop_column("list_id")
    op.drop_table("task_lists")
