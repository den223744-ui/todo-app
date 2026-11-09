"""Request and response schemas for lists."""

import uuid
from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.models.task_list import LIST_NAME_MAX_LENGTH

ListName = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=LIST_NAME_MAX_LENGTH)
]
ListColor = Literal["blue", "brown", "gray", "green", "red", "olive"]
Position = Annotated[float, Field(allow_inf_nan=False)]

NON_NULLABLE_LIST_FIELDS = ("name", "color", "position")


def _document_non_nullable_fields(schema: dict[str, Any]) -> None:
    """Omitted-but-not-null fields: publish them as non-nullable (see TaskUpdate)."""
    properties = schema["properties"]
    for name in NON_NULLABLE_LIST_FIELDS:
        prop = properties[name]
        (variant,) = [v for v in prop.pop("anyOf") if v != {"type": "null"}]
        prop.update(variant)
        prop.pop("default", None)


class TaskListCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: ListName
    # Omitted: the next colour in LIST_COLORS order.
    color: ListColor | None = None
    # Omitted: after the last list.
    position: Position | None = None


class TaskListUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", json_schema_extra=_document_non_nullable_fields)

    name: ListName | None = None
    color: ListColor | None = None
    position: Position | None = None

    @field_validator(*NON_NULLABLE_LIST_FIELDS, mode="before")
    @classmethod
    def _not_null(cls, value: Any) -> Any:
        if value is None:
            raise ValueError("may not be null")
        return value

    def changes(self) -> dict[str, Any]:
        return {name: getattr(self, name) for name in self.model_fields_set}


class TaskListRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: ListColor
    position: float
    created_at: datetime
    updated_at: datetime
