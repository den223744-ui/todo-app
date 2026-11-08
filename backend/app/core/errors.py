"""Unified error handling: every error leaves the API as {"error": {"code", "message"}}.

``code`` is a stable machine-readable identifier the client can branch on;
``message`` is a human-readable English explanation for developers (UI texts
live on the frontend).
"""

import logging
from collections.abc import Mapping, Sequence
from http import HTTPStatus
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.responses import JSONResponse

from app.schemas.errors import ErrorDetail, ErrorResponse

logger = logging.getLogger(__name__)

# Codes for errors raised by the framework itself (routing, method matching).
HTTP_STATUS_CODES: Mapping[int, str] = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    405: "method_not_allowed",
    409: "conflict",
    413: "payload_too_large",
    415: "unsupported_media_type",
    422: "validation_error",
    429: "too_many_requests",
}


class AppError(Exception):
    """Base for errors raised on purpose by services and dependencies."""

    status_code = 400
    code = "bad_request"

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class NotFoundError(AppError):
    # Also used for objects of another workspace: 404 rather than 403,
    # so the API does not reveal that the object exists.
    status_code = 404
    code = "not_found"


class SessionRequiredError(AppError):
    status_code = 401
    code = "session_required"


def error_response(
    status_code: int,
    code: str,
    message: str,
    headers: Mapping[str, str] | None = None,
) -> JSONResponse:
    body = ErrorResponse(error=ErrorDetail(code=code, message=message))
    return JSONResponse(status_code=status_code, content=body.model_dump(), headers=headers)


def format_validation_errors(errors: Sequence[Any]) -> str:
    """Turn pydantic errors into one line, e.g. 'body.title: Field required'.

    Input values are deliberately left out: they may be large or sensitive.
    """
    parts = []
    for error in errors:
        location = ".".join(str(part) for part in error.get("loc", ()))
        message = error.get("msg", "Invalid value")
        parts.append(f"{location}: {message}" if location else message)
    return "; ".join(parts) or "Invalid request"


async def _app_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    return error_response(exc.status_code, exc.code, exc.message)


async def _http_exception_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    status = exc.status_code
    message = exc.detail if isinstance(exc.detail, str) else HTTPStatus(status).phrase
    return error_response(
        status,
        HTTP_STATUS_CODES.get(status, "http_error"),
        message,
        # Keep headers such as Allow (405) or WWW-Authenticate.
        headers=exc.headers,
    )


async def _validation_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    return error_response(422, "validation_error", format_validation_errors(exc.errors()))


async def _unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
    # Details go to the log, never to the client.
    logger.exception("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return error_response(500, "internal_error", "Internal server error")


def register_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error_handler)
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)
    app.add_exception_handler(RequestValidationError, _validation_error_handler)
    # Starlette runs the Exception handler in its outermost middleware, so other
    # middleware (e.g. the session cleanup) still sees the exception first.
    app.add_exception_handler(Exception, _unhandled_error_handler)
