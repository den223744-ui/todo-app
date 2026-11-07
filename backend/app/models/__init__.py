"""SQLAlchemy models. Importing this package registers every table on Base.metadata."""

from app.models.base import Base
from app.models.task import Task
from app.models.workspace import Workspace

__all__ = ["Base", "Task", "Workspace"]
