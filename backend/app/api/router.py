from fastapi import APIRouter

from app.api import health, task_lists, tasks

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(tasks.router)
api_router.include_router(task_lists.router)
