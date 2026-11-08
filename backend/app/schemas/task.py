"""Request and response schemas for tasks."""

import uuid
from datetime import date, datetime, time
from typing import Annotated, Any, Self

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

from app.models.task import PRIORITY_MAX, PRIORITY_MIN, TITLE_MAX_LENGTH

NOTES_MAX_LENGTH = 10_000
TAGS_MAX_COUNT = 20
TAG_MAX_LENGTH = 50


def normalize_tags(tags: list[str]) -> list[str]:
    """'#Дом', ' дом ', 'ДОМ' -> 'дом'. Empty tags are dropped, order is kept."""
    normalized: list[str] = []
    for raw in tags:
        tag = raw.strip().lstrip("#").strip().lower()
        if not tag or tag in normalized:
            continue
        if len(tag) > TAG_MAX_LENGTH:
            raise ValueError(f"Tag is longer than {TAG_MAX_LENGTH} characters: {tag[:20]}...")
        normalized.append(tag)
    if len(normalized) > TAGS_MAX_COUNT:
        raise ValueError(f"At most {TAGS_MAX_COUNT} tags are allowed")
    return normalized


Title = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=TITLE_MAX_LENGTH)
]
Notes = Annotated[str, StringConstraints(max_length=NOTES_MAX_LENGTH)]
Priority = Annotated[int, Field(ge=PRIORITY_MIN, le=PRIORITY_MAX)]
Tags = Annotated[list[str], AfterValidator(normalize_tags)]
# Finite only: NaN or infinity would break ordering.
Position = Annotated[float, Field(allow_inf_nan=False)]


def _reject_utc_offset(value: time) -> time:
    if value.tzinfo is not None:
        raise ValueError("due_time is a local wall-clock time; send it without a UTC offset")
    return value


# "18:00" in the user's own timezone. Time zones are handled on the client
# (SPEC: smart lists depend on the user's timezone); an offset would be dropped
# silently by the TIME column, so it is rejected instead.
LocalTime = Annotated[time, AfterValidator(_reject_utc_offset)]


class TaskInput(BaseModel):
    # Unknown fields are an error: catches typos and attempts to set
    # server-owned fields such as workspace_id or deleted_at.
    model_config = ConfigDict(extra="forbid")


class TaskCreate(TaskInput):
    title: Title
    notes: Notes | None = None
    priority: Priority = PRIORITY_MIN
    due_date: date | None = None
    due_time: LocalTime | None = None
    tags: Tags = Field(default_factory=list)
    parent_id: uuid.UUID | None = None
    # Top-level tasks only: a subtask follows its parent's list.
    list_id: uuid.UUID | None = None
    # Omitted: the task goes to the end of its list.
    position: Position | None = None

    @model_validator(mode="after")
    def _time_needs_date(self) -> Self:
        if self.due_time is not None and self.due_date is None:
            raise ValueError("due_time requires due_date")
        return self


# PATCH fields that may be omitted but not set to null.
NON_NULLABLE_UPDATE_FIELDS = ("title", "priority", "tags", "position", "completed")


def _document_non_nullable_fields(schema: dict[str, Any]) -> None:
    """Describe omitted-but-not-null fields truthfully in OpenAPI.

    In Python they are ``X | None`` (None = "not sent"), which pydantic would
    publish as nullable. The API rejects null for them, and the generated
    TypeScript types must say ``title?: string``, not ``string | null``.
    """
    properties = schema["properties"]
    for name in NON_NULLABLE_UPDATE_FIELDS:
        prop = properties[name]
        (variant,) = [v for v in prop.pop("anyOf") if v != {"type": "null"}]
        prop.update(variant)
        prop.pop("default", None)


class TaskUpdate(TaskInput):
    """Partial update: only the fields present in the request are applied.

    ``null`` clears notes, due_date, due_time and list_id; for any other field
    it is an error. Rules that depend on the stored task (due_time needs
    due_date, only top-level tasks have a list) are checked by the service.
    """

    model_config = ConfigDict(extra="forbid", json_schema_extra=_document_non_nullable_fields)

    title: Title | None = None
    notes: Notes | None = None
    priority: Priority | None = None
    due_date: date | None = None
    due_time: LocalTime | None = None
    tags: Tags | None = None
    # null takes the task out of its list.
    list_id: uuid.UUID | None = None
    position: Position | None = None
    completed: bool | None = None

    @field_validator(*NON_NULLABLE_UPDATE_FIELDS, mode="before")
    @classmethod
    def _not_null(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("may not be null")
        return value

    def changes(self) -> dict[str, Any]:
        """The fields the client actually sent, with their validated values."""
        return {name: getattr(self, name) for name in self.model_fields_set}


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    parent_id: uuid.UUID | None
    list_id: uuid.UUID | None
    title: str
    notes: str | None
    priority: int
    due_date: date | None
    due_time: time | None
    tags: list[str]
    position: float
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
