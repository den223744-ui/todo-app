"""Task endpoints. Thin: validation is in schemas, rules are in services/tasks.py."""

import uuid

from fastapi import APIRouter, Response, status

from app.api.deps import DbSession, WorkspaceId
from app.api.responses import error_responses
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services import tasks as service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", operation_id="listTasks")
async def list_tasks(session: DbSession, workspace_id: WorkspaceId) -> list[TaskRead]:
    """All tasks of the workspace that are not deleted, subtasks included (flat list).

    Starts the anonymous session on the first visit (sets the session cookie).
    """
    tasks = await service.list_tasks(session, workspace_id)
    return [TaskRead.model_validate(task) for task in tasks]


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    operation_id="createTask",
    responses=error_responses(401, 404, 422),
)
async def create_task(data: TaskCreate, session: DbSession, workspace_id: WorkspaceId) -> TaskRead:
    """Create a task. Without ``position`` it goes to the end of its list.

    404 when ``parent_id`` does not point at a live task of this workspace.
    """
    task = await service.create_task(session, workspace_id, data)
    return TaskRead.model_validate(task)


@router.patch(
    "/{task_id}",
    operation_id="updateTask",
    responses=error_responses(401, 404, 422),
)
async def update_task(
    task_id: uuid.UUID, data: TaskUpdate, session: DbSession, workspace_id: WorkspaceId
) -> TaskRead:
    """Partial update: only the fields present in the body change.

    ``null`` clears notes, due_date and due_time; clearing due_date also clears
    due_time. ``completed`` completes or reopens the task.
    """
    task = await service.update_task(session, workspace_id, task_id, data)
    return TaskRead.model_validate(task)


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    operation_id="deleteTask",
    responses=error_responses(401, 404, 422),
)
async def delete_task(
    task_id: uuid.UUID, session: DbSession, workspace_id: WorkspaceId
) -> Response:
    """Soft delete the task and its subtasks; restorable via POST .../restore."""
    await service.delete_task(session, workspace_id, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{task_id}/restore",
    operation_id="restoreTask",
    responses=error_responses(401, 404, 409, 422),
)
async def restore_task(
    task_id: uuid.UUID, session: DbSession, workspace_id: WorkspaceId
) -> TaskRead:
    """Undo a delete: the task comes back with the subtasks deleted together with it.

    409 for a subtask whose parent is still deleted.
    """
    task = await service.restore_task(session, workspace_id, task_id)
    return TaskRead.model_validate(task)
