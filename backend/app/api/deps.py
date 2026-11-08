"""Shared FastAPI dependencies for routers."""

import uuid
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session


def get_workspace_id(request: Request) -> uuid.UUID:
    """The current visitor's workspace, resolved by WorkspaceSessionMiddleware."""
    workspace_id: uuid.UUID | None = getattr(request.state, "workspace_id", None)
    if workspace_id is None:
        raise RuntimeError(
            f"No workspace for {request.url.path}: the path is exempt from the session middleware"
        )
    return workspace_id


WorkspaceId = Annotated[uuid.UUID, Depends(get_workspace_id)]
DbSession = Annotated[AsyncSession, Depends(get_session)]
