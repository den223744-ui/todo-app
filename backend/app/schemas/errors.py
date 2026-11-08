from pydantic import BaseModel


class ErrorDetail(BaseModel):
    code: str
    message: str


class ErrorResponse(BaseModel):
    """The single error shape of the API: ``{"error": {"code", "message"}}``."""

    error: ErrorDetail
