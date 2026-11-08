"""create workspaces and tasks

Revision ID: 0001
Revises:
Create Date: 2026-11-08 00:11:01.280793

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "workspaces",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_workspaces")),
    )
    op.create_table(
        "tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("workspace_id", sa.Uuid(), nullable=False),
        sa.Column("parent_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("priority", sa.Integer(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("due_time", sa.Time(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("position", sa.Double(), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "due_time IS NULL OR due_date IS NOT NULL",
            name=op.f("ck_tasks_due_time_needs_date"),
        ),
        sa.CheckConstraint("length(title) BETWEEN 1 AND 500", name=op.f("ck_tasks_title_length")),
        sa.CheckConstraint(
            "parent_id IS NULL OR parent_id != id", name=op.f("ck_tasks_not_own_parent")
        ),
        sa.CheckConstraint("priority BETWEEN 0 AND 3", name=op.f("ck_tasks_priority_range")),
        sa.ForeignKeyConstraint(
            ["parent_id"],
            ["tasks.id"],
            name=op.f("fk_tasks_parent_id_tasks"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["workspace_id"],
            ["workspaces.id"],
            name=op.f("fk_tasks_workspace_id_workspaces"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tasks")),
    )
    op.create_index(op.f("ix_tasks_parent_id"), "tasks", ["parent_id"], unique=False)
    op.create_index(
        "ix_tasks_workspace_id_deleted_at", "tasks", ["workspace_id", "deleted_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_tasks_workspace_id_deleted_at", table_name="tasks")
    op.drop_index(op.f("ix_tasks_parent_id"), table_name="tasks")
    op.drop_table("tasks")
    op.drop_table("workspaces")
