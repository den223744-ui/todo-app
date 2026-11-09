"""Anonymous workspaces: every visitor gets their own task list without signing up."""

import uuid
from datetime import date

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import utcnow
from app.models import Workspace
from app.services.demo import seed_demo


def parse_workspace_id(raw: str | None) -> uuid.UUID | None:
    """Parse the id from the session cookie; anything malformed counts as absent."""
    if not raw:
        return None
    try:
        return uuid.UUID(raw)
    except ValueError:
        return None


async def find_workspace(session: AsyncSession, raw_id: str | None) -> Workspace | None:
    workspace_id = parse_workspace_id(raw_id)
    if workspace_id is None:
        return None
    return await session.get(Workspace, workspace_id)


async def create_workspace(session: AsyncSession, *, demo_day: date | None = None) -> Workspace:
    """Create a workspace with a server-generated id.

    The id from an unknown cookie is never adopted, so a client cannot pick
    its own workspace id (session fixation). With ``demo_day`` the workspace
    starts with example content around that day, in the same transaction.
    """
    workspace = Workspace(id=uuid.uuid4())
    session.add(workspace)
    if demo_day is None:
        await session.commit()
    else:
        await session.flush()
        await seed_demo(session, workspace.id, demo_day, utcnow())
    return workspace


async def delete_workspace(session: AsyncSession, workspace_id: uuid.UUID) -> None:
    await session.execute(delete(Workspace).where(Workspace.id == workspace_id))
    await session.commit()
