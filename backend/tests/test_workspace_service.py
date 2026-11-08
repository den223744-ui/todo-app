import uuid

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Workspace
from app.services.workspaces import (
    create_workspace,
    delete_workspace,
    find_workspace,
    parse_workspace_id,
)

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
async def test_find_existing_workspace(session: AsyncSession) -> None:
    existing = await create_workspace(session)

    found = await find_workspace(session, str(existing.id))

    assert found is not None
    assert found.id == existing.id


@pytest.mark.anyio
@pytest.mark.parametrize("raw", [None, "garbage", VALID])
async def test_find_returns_none_for_missing_workspace(
    session: AsyncSession, raw: str | None
) -> None:
    assert await find_workspace(session, raw) is None


@pytest.mark.anyio
async def test_created_workspace_is_persisted(session: AsyncSession) -> None:
    workspace = await create_workspace(session)

    assert await session.get(Workspace, workspace.id, populate_existing=True) is not None


@pytest.mark.anyio
async def test_delete_workspace(session: AsyncSession) -> None:
    keep = await create_workspace(session)
    drop = await create_workspace(session)

    await delete_workspace(session, drop.id)

    ids = (await session.scalars(select(Workspace.id))).all()
    assert ids == [keep.id]
    assert await session.scalar(select(func.count()).select_from(Workspace)) == 1
