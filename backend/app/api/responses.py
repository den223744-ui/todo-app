"""OpenAPI descriptions of error responses, so the generated client knows their shape.

Declaring 422 here also replaces FastAPI's default HTTPValidationError schema,
which this API never returns (see app/core/errors.py).
"""

from typing import Any

from app.schemas.errors import ErrorResponse

ERROR_DESCRIPTIONS = {
    401: "No valid session. Writes need a session started by a GET (session_required).",
    404: "Task not found, deleted, or owned by another workspace (not_found).",
    409: "The request conflicts with the current state (conflict).",
    422: "The request is invalid (validation_error).",
}


def error_responses(*statuses: int) -> dict[int | str, dict[str, Any]]:
    return {
        status: {"model": ErrorResponse, "description": ERROR_DESCRIPTIONS[status]}
        for status in statuses
    }
