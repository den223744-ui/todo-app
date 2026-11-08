import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.time import utcnow
from app.models.base import Base, UTCDateTime

LIST_NAME_MAX_LENGTH = 100
# Muted colours for the dot next to a list; the frontend maps each name to its
# theme colours. A new list gets the next one in this order.
LIST_COLORS = ("blue", "brown", "gray", "green", "red", "olive")


class TaskList(Base):
    """A user's list (Работа, Дом, ...). A top-level task belongs to at most one."""

    __tablename__ = "task_lists"
    __table_args__ = (
        CheckConstraint(f"length(name) BETWEEN 1 AND {LIST_NAME_MAX_LENGTH}", name="name_length"),
        # Names are unique per workspace, ignoring case: name_key is the
        # casefolded name, computed in Python so SQLite and PostgreSQL agree.
        UniqueConstraint("workspace_id", "name_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # No separate index: the unique constraint starts with workspace_id.
    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspaces.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(LIST_NAME_MAX_LENGTH))
    name_key: Mapped[str] = mapped_column(String(LIST_NAME_MAX_LENGTH))
    color: Mapped[str] = mapped_column(String(20))
    position: Mapped[float]
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow, onupdate=utcnow)
