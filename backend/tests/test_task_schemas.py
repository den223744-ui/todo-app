from datetime import date, time
from typing import Any

import pytest
from pydantic import ValidationError

from app.schemas.task import TaskCreate, TaskUpdate, normalize_tags


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ([], []),
        (["#Дом", " дом ", "ДОМ"], ["дом"]),
        (["work", "#", "  ", ""], ["work"]),
        (["b", "a", "B"], ["b", "a"]),
        (["# spaced  "], ["spaced"]),
        (["x" * 50], ["x" * 50]),
    ],
)
def test_normalize_tags(given: list[str], expected: list[str]) -> None:
    assert normalize_tags(given) == expected


def test_too_long_tag_is_rejected() -> None:
    with pytest.raises(ValueError, match="longer than 50"):
        normalize_tags(["x" * 51])


def test_tag_count_is_checked_after_dedupe() -> None:
    assert len(normalize_tags([f"t{i}" for i in range(20)] + ["T0", "#t1"])) == 20
    with pytest.raises(ValueError, match="At most 20"):
        normalize_tags([f"t{i}" for i in range(21)])


def test_create_defaults_and_normalization() -> None:
    task = TaskCreate.model_validate({"title": "  Купить молоко  ", "tags": ["#Дом"]})

    assert task.title == "Купить молоко"
    assert task.tags == ["дом"]
    assert task.priority == 0
    assert task.notes is None
    assert task.position is None
    assert task.parent_id is None


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({}, id="no-title"),
        pytest.param({"title": "   "}, id="blank-title"),
        pytest.param({"title": "x" * 501}, id="title-too-long"),
        pytest.param({"title": "t", "priority": 4}, id="priority-too-high"),
        pytest.param({"title": "t", "priority": -1}, id="priority-too-low"),
        pytest.param({"title": "t", "due_time": "18:00"}, id="time-without-date"),
        pytest.param({"title": "t", "notes": "x" * 10_001}, id="notes-too-long"),
        pytest.param({"title": "t", "position": "nan"}, id="position-nan"),
        pytest.param({"title": "t", "position": "inf"}, id="position-inf"),
        pytest.param({"title": "t", "workspace_id": "x"}, id="unknown-field"),
        pytest.param({"title": "t", "tags": ["x" * 51]}, id="tag-too-long"),
    ],
)
def test_create_rejects(payload: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        TaskCreate.model_validate(payload)


def test_create_accepts_full_payload() -> None:
    task = TaskCreate.model_validate(
        {
            "title": "t",
            "notes": "n",
            "priority": 3,
            "due_date": "2026-11-09",
            "due_time": "18:00",
            "tags": ["a"],
            "position": 1.5,
            "parent_id": "6f1c1c3e-8a4b-4a49-9a4f-3f8a8f0f2d11",
        }
    )

    assert task.due_date == date(2026, 11, 9)
    assert task.due_time == time(18, 0)
    assert task.priority == 3
    assert task.position == 1.5


def test_create_accepts_title_of_max_length() -> None:
    assert TaskCreate.model_validate({"title": "x" * 500}).title == "x" * 500


def test_update_tracks_only_sent_fields() -> None:
    update = TaskUpdate.model_validate({"notes": None, "priority": 2})

    assert update.changes() == {"notes": None, "priority": 2}


def test_update_normalizes_like_create() -> None:
    update = TaskUpdate.model_validate({"title": " t ", "tags": ["#A", "a"]})

    assert update.changes() == {"title": "t", "tags": ["a"]}


@pytest.mark.parametrize("field", ["notes", "due_date", "due_time"])
def test_update_allows_clearing_optional_fields(field: str) -> None:
    assert TaskUpdate.model_validate({field: None}).changes() == {field: None}


@pytest.mark.parametrize("field", ["title", "priority", "tags", "position", "completed"])
def test_update_rejects_null_for_required_fields(field: str) -> None:
    with pytest.raises(ValidationError, match="may not be null"):
        TaskUpdate.model_validate({field: None})


@pytest.mark.parametrize(
    "payload",
    [
        pytest.param({"parent_id": None}, id="parent-is-not-updatable"),
        pytest.param({"completed_at": None}, id="server-owned-field"),
        pytest.param({"priority": 9}, id="priority-out-of-range"),
        pytest.param({"title": ""}, id="empty-title"),
    ],
)
def test_update_rejects(payload: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        TaskUpdate.model_validate(payload)


@pytest.mark.parametrize("value", ["18:00:00+03:00", "18:00Z", "18:00:00-05:00"])
def test_due_time_with_utc_offset_is_rejected(value: str) -> None:
    with pytest.raises(ValidationError, match="without a UTC offset"):
        TaskCreate.model_validate({"title": "t", "due_date": "2026-11-09", "due_time": value})
    with pytest.raises(ValidationError, match="without a UTC offset"):
        TaskUpdate.model_validate({"due_time": value})


def test_due_time_is_local_wall_clock_time() -> None:
    task = TaskCreate.model_validate({"title": "t", "due_date": "2026-11-09", "due_time": "18:00"})

    assert task.due_time == time(18, 0)
    assert task.due_time.tzinfo is None
