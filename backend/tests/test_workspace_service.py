import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Workspace
from app.services.workspaces import get_or_create_workspace, parse_workspace_id

VALID = "6f1c1c3e-8a4b-4a49-9a4f-3f8a8f0f2d11"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        (None, None),
        ("", None),
        ("garbage", None),
        ("123", None),
        (VALID, uuid.UUID(VALID)),
        (VALID.upper(), uuid.UUID(VALID)),
    ],
)
def test_parse_workspace_id(raw: str | None, expected: uuid.UUID | None) -> None:
    assert parse_workspace_id(raw) == expected


@pytest.mark.anyio
async def test_existing_workspace_is_returned(session: AsyncSession) -> None:
    existing = Workspace()
    session.add(existing)
    await session.commit()

    workspace = await get_or_create_workspace(session, str(existing.id))

    assert workspace.id == existing.id
    assert await session.scalar(select(func.count()).select_from(Workspace)) == 1


@pytest.mark.anyio
@pytest.mark.parametrize("raw", [None, "garbage", VALID])
async def test_missing_workspace_is_created_with_server_id(
    session: AsyncSession, raw: str | None
) -> None:
    workspace = await get_or_create_workspace(session, raw)

    assert str(workspace.id) != raw
    assert await session.get(Workspace, workspace.id) is not None
