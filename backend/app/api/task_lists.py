"""List endpoints. Thin: validation is in schemas, rules are in services/task_lists.py."""

import uuid

from fastapi import APIRouter, Response, status

from app.api.deps import DbSession, WorkspaceId
from app.api.responses import error_responses
from app.schemas.task_list import TaskListCreate, TaskListRead, TaskListUpdate
from app.services import task_lists as service

router = APIRouter(prefix="/lists", tags=["lists"])


@router.get("", operation_id="listLists")
async def list_lists(session: DbSession, workspace_id: WorkspaceId) -> list[TaskListRead]:
    """The workspace's lists in display order.

    Starts the anonymous session on the first visit (sets the session cookie).
    """
    lists = await service.list_lists(session, workspace_id)
    return [TaskListRead.model_validate(task_list) for task_list in lists]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    operation_id="createList",
    responses=error_responses(401, 409, 422),
)
async def create_list(
    data: TaskListCreate, session: DbSession, workspace_id: WorkspaceId
) -> TaskListRead:
    """Create a list. 409 when the workspace already has one with this name (any case)."""
    task_list = await service.create_list(session, workspace_id, data)
    return TaskListRead.model_validate(task_list)


@router.patch(
    "/{list_id}",
    operation_id="updateList",
    responses=error_responses(401, 404, 409, 422),
)
async def update_list(
    list_id: uuid.UUID, data: TaskListUpdate, session: DbSession, workspace_id: WorkspaceId
) -> TaskListRead:
    """Rename, recolour or move a list. 409 for a name another list already has."""
    task_list = await service.update_list(session, workspace_id, list_id, data)
    return TaskListRead.model_validate(task_list)


@router.delete(
    "/{list_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteList",
    responses=error_responses(401, 404, 422),
)
async def delete_list(
    list_id: uuid.UUID, session: DbSession, workspace_id: WorkspaceId
) -> Response:
    """Delete the list; its tasks stay and lose their list."""
    await service.delete_list(session, workspace_id, list_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
