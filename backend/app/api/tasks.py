"""Task endpoints. Thin: validation is in schemas, rules are in services/tasks.py."""

import uuid

from fastapi import APIRouter, Response, status

from app.api.deps import DbSession, WorkspaceId
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services import tasks as service

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.get("", operation_id="listTasks")
async def list_tasks(session: DbSession, workspace_id: WorkspaceId) -> list[TaskRead]:
    """All tasks of the workspace that are not deleted, subtasks included (flat list)."""
    tasks = await service.list_tasks(session, workspace_id)
    return [TaskRead.model_validate(task) for task in tasks]


@router.post("", status_code=status.HTTP_201_CREATED, operation_id="createTask")
async def create_task(data: TaskCreate, session: DbSession, workspace_id: WorkspaceId) -> TaskRead:
    task = await service.create_task(session, workspace_id, data)
    return TaskRead.model_validate(task)


@router.patch("/{task_id}", operation_id="updateTask")
async def update_task(
    task_id: uuid.UUID, data: TaskUpdate, session: DbSession, workspace_id: WorkspaceId
) -> TaskRead:
    """Partial update: only the fields present in the body change."""
    task = await service.update_task(session, workspace_id, task_id, data)
    return TaskRead.model_validate(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, operation_id="deleteTask")
async def delete_task(
    task_id: uuid.UUID, session: DbSession, workspace_id: WorkspaceId
) -> Response:
    """Soft delete the task and its subtasks; restorable via POST .../restore."""
    await service.delete_task(session, workspace_id, task_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{task_id}/restore", operation_id="restoreTask")
async def restore_task(
    task_id: uuid.UUID, session: DbSession, workspace_id: WorkspaceId
) -> TaskRead:
    """Undo a delete: the task comes back with the subtasks deleted together with it."""
    task = await service.restore_task(session, workspace_id, task_id)
    return TaskRead.model_validate(task)
