import uuid
from datetime import datetime

from sqlalchemy.orm import Mapped, mapped_column

from app.core.time import utcnow
from app.models.base import Base, UTCDateTime


class Workspace(Base):
    """Anonymous owner of a task list, identified by an httpOnly cookie."""

    __tablename__ = "workspaces"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=utcnow)
