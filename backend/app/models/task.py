import uuid
from datetime import date, datetime, time

from sqlalchemy import JSON, CheckConstraint, ForeignKey, Index, String, Text
from sqlalchemy.ext.mutable import MutableList
from sqlalchemy.orm import Mapped, mapped_column

from app.core.time import utcnow
from app.models.base import Base, UTCDateTime

TITLE_MAX_LENGTH = 500
PRIORITY_MIN = 0
PRIORITY_MAX = 3


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            f"priority BETWEEN {PRIORITY_MIN} AND {PRIORITY_MAX}", name="priority_range"
        ),
        CheckConstraint(f"length(title) BETWEEN 1 AND {TITLE_MAX_LENGTH}", name="title_length"),
        CheckConstraint("due_time IS NULL OR due_date IS NOT NULL", name="due_time_needs_date"),
        CheckConstraint("parent_id IS NULL OR parent_id != id", name="not_own_parent"),
        # The main read path: all live tasks of one workspace.
        Index("ix_tasks_workspace_id_deleted_at", "workspace_id", "deleted_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    # One level of nesting is a business rule, enforced in the service layer.
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(TITLE_MAX_LENGTH))
    notes: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[int] = mapped_column(default=PRIORITY_MIN)
    due_date: Mapped[date | None]
    due_time: Mapped[time | None]
    # A JSON list instead of a many-to-many table: see README, section on trade-offs.
    # MutableList makes in-place edits (append, remove) mark the row dirty;
    # plain JSON only notices when the whole list is reassigned.
    tags: Mapped[list[str]] = mapped_column(MutableList.as_mutable(JSON), default=list)
    # Fractional ordering: a moved task gets the midpoint between its new neighbours.
    position: Mapped[float]
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    # Soft delete keeps the row so that Undo can restore it.
    deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime())
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, onupdate=utcnow)
