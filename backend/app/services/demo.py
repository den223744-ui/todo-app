# The demo content is Russian text; Cyrillic letters are not confusables here.
# ruff: noqa: RUF001
"""Example content for a new visitor's workspace.

The demo is looked at by people who open it once: an empty screen shows
nothing, so a new workspace starts with a realistic week — lists, a timed
day for the timeline, subtasks, tags, notes, something overdue, something
already done. Dates are relative to the visitor's local day.
"""

import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Task, TaskList
from app.services.task_lists import name_key

# The client's local date may differ from the server's UTC date by at most a
# day (UTC-12 … UTC+14); anything further is ignored as malformed.
MAX_CLIENT_DAY_SKEW = 1


def visitor_today(raw: str | None, utc_today: date) -> date:
    """The visitor's local date from the client header, or the UTC date."""
    if raw:
        try:
            local = date.fromisoformat(raw)
        except ValueError:
            return utc_today
        if abs((local - utc_today).days) <= MAX_CLIENT_DAY_SKEW:
            return local
    return utc_today


@dataclass(frozen=True)
class DemoTask:
    title: str
    day: int | None = None  # days from today; None = no date (Inbox)
    at: time | None = None
    minutes: int | None = None
    list: str | None = None
    priority: int = 0
    tags: tuple[str, ...] = ()
    notes: str | None = None
    done: bool = False
    subtasks: tuple[tuple[str, bool], ...] = field(default=())


DEMO_LISTS = (("Работа", "blue"), ("Дом", "green"), ("Здоровье", "red"))

DEMO_TASKS = (
    # Today, on the timeline.
    DemoTask("Утренняя пробежка", 0, time(7, 30), 30, "Здоровье", tags=("спорт",), done=True),
    DemoTask(
        "Созвон с командой по релизу",
        0,
        time(10, 0),
        30,
        "Работа",
        priority=2,
        tags=("созвон",),
        notes="Статус задач, блокеры, дата выкладки.",
    ),
    DemoTask(
        "Ревью pull request’а с новым API",
        0,
        time(11, 0),
        60,
        "Работа",
        tags=("код",),
        subtasks=(
            ("Прочитать описание и задачу", True),
            ("Проверить тесты и покрытие", False),
            ("Оставить комментарии", False),
        ),
    ),
    DemoTask("Обед с Аней", 0, time(13, 30), 60),
    DemoTask("Тренировка в зале", 0, time(18, 30), 60, "Здоровье", tags=("спорт",)),
    # Today, without a time.
    DemoTask("Ответить на письма", 0, list="Работа", done=True),
    DemoTask("Оплатить интернет", 0, list="Дом", priority=3, tags=("счета",)),
    DemoTask(
        "Купить продукты",
        0,
        list="Дом",
        tags=("покупки",),
        notes="На ужин — паста с овощами.",
        subtasks=(("Молоко", True), ("Хлеб", False), ("Помидоры и базилик", False)),
    ),
    # Overdue.
    DemoTask("Отправить отчёт за месяц", -2, list="Работа", priority=2, tags=("отчёт",)),
    DemoTask("Записаться к стоматологу", -1, list="Здоровье"),
    # Tomorrow and later.
    DemoTask(
        "Подготовить презентацию для клиента",
        1,
        time(15, 0),
        90,
        "Работа",
        priority=2,
        tags=("презентация",),
        subtasks=(("Собрать цифры", False), ("Сделать слайды", False), ("Прогнать вслух", False)),
    ),
    DemoTask("Полить цветы", 1, list="Дом"),
    DemoTask("Купить подарок маме на день рождения", 3, list="Дом", priority=3, tags=("семья",)),
    DemoTask("Сдать книги в библиотеку", 5, tags=("книги",)),
    DemoTask("Техосмотр машины", 9, time(9, 0), 120),
    # Inbox: no date yet.
    DemoTask("Прочитать «Чистую архитектуру»", tags=("книги",)),
    DemoTask(
        "Идеи для отпуска",
        notes="Грузия или Алтай? Посмотреть билеты на май.",
        tags=("путешествия",),
    ),
    DemoTask("Разобрать фото с поездки"),
    # Done earlier: shows up in «Выполненные».
    DemoTask("Продлить подписку на облако", -3, list="Дом", done=True),
)


async def seed_demo(
    session: AsyncSession, workspace_id: uuid.UUID, today: date, now: datetime
) -> None:
    """Add the example lists and tasks to a workspace (one commit)."""
    lists: dict[str, uuid.UUID] = {}
    for index, (name, color) in enumerate(DEMO_LISTS, start=1):
        task_list = TaskList(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            name=name,
            name_key=name_key(name),
            color=color,
            position=float(index),
            created_at=now,
            updated_at=now,
        )
        session.add(task_list)
        lists[name] = task_list.id
    # The models have no relationships, so the unit of work cannot order the
    # inserts by foreign key: flush each level before the next one refers to it.
    await session.flush()

    # Earlier items are created a moment earlier, so creation order is stable too.
    parents: list[tuple[Task, DemoTask, datetime]] = []
    for index, item in enumerate(DEMO_TASKS, start=1):
        created = now - timedelta(seconds=len(DEMO_TASKS) - index)
        due = None if item.day is None else today + timedelta(days=item.day)
        parent = Task(
            id=uuid.uuid4(),
            workspace_id=workspace_id,
            list_id=lists[item.list] if item.list else None,
            title=item.title,
            notes=item.notes,
            priority=item.priority,
            due_date=due,
            due_time=item.at,
            duration_minutes=item.minutes,
            tags=list(item.tags),
            position=float(index),
            completed_at=_completed_at(item, now),
            created_at=created,
            updated_at=created,
        )
        session.add(parent)
        parents.append((parent, item, created))
    await session.flush()

    for parent, item, created in parents:
        for sub_index, (title, done) in enumerate(item.subtasks, start=1):
            session.add(
                Task(
                    workspace_id=workspace_id,
                    parent_id=parent.id,
                    title=title,
                    tags=[],
                    position=float(sub_index),
                    completed_at=now if done else None,
                    created_at=created,
                    updated_at=created,
                )
            )
    await session.commit()


def _completed_at(item: DemoTask, now: datetime) -> datetime | None:
    if not item.done:
        return None
    # Done today means "just now"; done on an earlier day means that day.
    days_ago = max(0, -(item.day or 0))
    return now - timedelta(days=days_ago)
