import type { QuickAddIssue } from '../domain/quickAddInput';
import type { SmartList } from '../domain/smartLists';
import type { EditIssue } from '../domain/taskEdit';

/** All UI texts in one place: the UI is Russian, the code is English. */
export const TEXTS = {
  appTitle: 'Задачи',
  brand: 'TOOD',
  quickAddList: 'Список для новой задачи',
  quickAddNoList: 'Без списка',
  favorites: 'Избранное',
  newList: 'Новый список',
  newListName: 'Название списка',
  navigation: 'Навигация',
  openMenu: 'Открыть меню',
  closeMenu: 'Закрыть меню',
  smartLists: 'Списки',
  tags: 'Теги',
  tagsEmpty: 'Добавьте к задаче #тег — он появится здесь.',
  quickAdd: 'Новая задача',
  quickAddPlaceholder: 'Запланировать дело',
  quickAddHint: 'Enter — добавить. Даты, #теги, @списки и !приоритет распознаются автоматически.',
  quickAddSubmit: 'Добавить',
  quickAddAdded: (section: string, date: string | null) =>
    `Добавлено в «${section}»${date ? `, ${date}` : ''}`,
  quickAddShow: 'Показать',
  taskList: 'Список задач',
  loadingTasks: 'Загружаем задачи…',
  loadTasksError: 'Не удалось загрузить задачи.',
  refreshTasksError: 'Не удалось обновить список. Показаны сохранённые данные.',
  retry: 'Повторить',
  dismissError: 'Закрыть сообщение',
  searchEmpty: 'Ничего не найдено',
  searchEmptyHint: 'Попробуйте другой запрос.',
  tagEmpty: 'В этом теге пока нет задач',
  tagEmptyHint: 'Здесь появятся невыполненные задачи с этим тегом.',
  listEmpty: 'В этом списке пока нет задач',
  dayEmpty: 'На этот день задач нет',
  dayEmptyHint: 'Добавьте задачу — она будет запланирована на этот день.',
  dayClosed: 'Все дела на сегодня сделаны',
  dayClosedHint: 'Отдыхайте или запланируйте что-то на завтра',
  dayViews: 'Вид задач на день',
  listTab: 'Список',
  listEmptyHint: 'Добавьте задачу — она попадёт в этот список.',
  listFallbackTitle: 'Список',
  noList: 'Без списка',
  tomorrow: 'Завтра',
  dayAfterTomorrow: 'Послезавтра',
  /** Starts with the visible counter (WCAG 2.5.3: the name contains the visible label). */
  subtasksToggle: (done: number, total: number, expanded: boolean, title: string) =>
    `${String(done)}/${String(total)}, ${expanded ? 'скрыть' : 'показать'} подзадачи: ${title}`,
  subtasksFor: (title: string) => `Подзадачи: ${title}`,
  moveToToday: 'На сегодня',
  moveToTodayNamed: (title: string) => `Перенести на сегодня: ${title}`,
  moveAllToToday: (count: number) => `Перенести все на сегодня (${String(count)})`,
  taskCount: (count: number) => `${String(count)} ${plural(count, 'задача', 'задачи', 'задач')}`,
  completeTask: (title: string) => `Выполнить: ${title}`,
  deleteTaskNamed: (title: string) => `Удалить задачу: ${title}`,
  reopenTask: (title: string) => `Вернуть в работу: ${title}`,
} as const;

export const QUICK_ADD_ISSUES: Record<QuickAddIssue, string> = {
  'title-required': 'Добавьте название задачи, кроме даты, тегов и приоритета.',
  'title-too-long': 'Название задачи должно быть не длиннее 500 символов.',
  'too-many-tags': 'У задачи может быть не больше 20 тегов.',
  'tag-too-long': 'Тег должен быть не длиннее 50 символов.',
};

export const PRIORITY_LABELS: Readonly<Record<number, string>> = {
  1: 'Низкий приоритет',
  2: 'Средний приоритет',
  3: 'Высокий приоритет',
};

export const EMPTY_LIST_TEXTS: Record<SmartList, { title: string; hint: string }> = {
  inbox: { title: 'Входящие пусты', hint: 'Здесь появятся задачи без даты.' },
  today: {
    title: 'На сегодня задач нет',
    hint: 'Задачи на сегодня и просроченные появятся здесь.',
  },
  upcoming: {
    title: 'Пока ничего не запланировано',
    hint: 'Здесь появятся задачи на будущие дни.',
  },
  overdue: { title: 'Просроченных задач нет', hint: 'Все сроки под контролем.' },
  completed: {
    title: 'Выполненных задач пока нет',
    hint: 'Отмечайте готовые задачи — они появятся здесь.',
  },
};

/** Russian plural form: 1 задача, 2 задачи, 5 задач, 21 задача, 11 задач. */
function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const LIST_TITLES: Record<SmartList, string> = {
  inbox: 'Входящие',
  today: 'Сегодня',
  upcoming: 'Предстоящие',
  overdue: 'Просроченные',
  completed: 'Выполненные',
};

/** Hints for edits that the API would reject. */
export const EDIT_ISSUES: Record<EditIssue, string> = {
  'title-required': 'Название не может быть пустым.',
  'title-too-long': 'Название должно быть не длиннее 500 символов.',
  'notes-too-long': 'Заметки должны быть не длиннее 10 000 символов.',
  'tag-too-long': 'Тег должен быть не длиннее 50 символов.',
  'too-many-tags': 'У задачи может быть не больше 20 тегов.',
  'time-needs-date': 'Сначала выберите дату — время без даты не сохраняется.',
};

/** Task editing: inline title and the detail panel. */
export const EDIT_TEXTS = {
  list: 'Список',
  noList: 'Без списка',
  editTitle: (title: string) => `Изменить название: ${title}`,
  details: 'Детали задачи',
  closeDetails: 'Закрыть детали',
  notFound: 'Задача не найдена',
  notFoundHint: 'Возможно, она удалена или открыта ссылка из другого браузера.',
  title: 'Название',
  notes: 'Заметки',
  noteHeading: 'Заметка',
  due: 'Срок',
  notesPlaceholder: 'Добавьте детали…',
  dueDate: 'Дата',
  dueTime: 'Время',
  clearDate: 'Убрать дату',
  priority: 'Приоритет',
  priorityNone: 'Нет',
  priorityNames: ['Без приоритета', 'Низкий', 'Средний', 'Высокий'],
  tags: 'Теги',
  addTag: 'Добавить тег',
  addTagPlaceholder: 'Новый тег',
  removeTag: (tag: string) => `Убрать тег ${tag}`,
  subtasks: 'Подзадачи',
  subtaskProgress: (done: number, total: number) => `${String(done)} из ${String(total)}`,
  addSubtask: 'Новая подзадача',
  addSubtaskPlaceholder: 'Добавить подзадачу…',
  subtaskTitle: (title: string) => `Название подзадачи: ${title}`,
  deleteSubtask: (title: string) => `Удалить подзадачу: ${title}`,
  deleteTask: 'Удалить задачу',
  saveError: 'Не удалось сохранить изменение. Оно отменено.',
  createdAt: (date: string) => `Создана ${date}`,
} as const;

export const SEARCH_TEXTS = {
  open: 'Открыть поиск',
  close: 'Закрыть поиск',
  label: 'Поиск по задачам',
  placeholder: 'Поиск по всем задачам',
  found: 'Найдено',
  completed: 'Выполненные',
  results: (query: string) => `Результаты поиска «${query}»`,
} as const;

/** Toasts for writes the server refused; the change has already been rolled back. */
export const TOAST_TEXTS = {
  region: 'Уведомления',
  close: 'Закрыть уведомление',
  createFailed: (title: string) => `Не удалось создать задачу «${title}».`,
  updateFailed: 'Не удалось сохранить изменение — оно отменено.',
  deleteFailed: 'Не удалось удалить задачу — она возвращена в список.',
  restoreFailed: 'Не удалось восстановить задачу.',
  createListFailed: (name: string) => `Не удалось создать список «${name}».`,
  listNameTaken: 'Список с таким названием уже есть.',
  updateListFailed: 'Не удалось изменить список — изменение отменено.',
  deleteListFailed: 'Не удалось удалить список — он восстановлен.',
  offline: 'Нет связи с сервером. Проверьте подключение.',
} as const;

export const DAY_NAV_TEXTS = {
  group: 'Выбор дня',
  previous: 'Предыдущий день',
  next: 'Следующий день',
  today: 'Сегодня',
} as const;

/** 30 -> '30 мин', 60 -> '1 ч', 90 -> '1 ч 30 мин'. */
export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${String(rest)} мин`;
  return rest === 0 ? `${String(hours)} ч` : `${String(hours)} ч ${String(rest)} мин`;
}

export const DURATION_TEXTS = {
  label: 'Длительность',
  none: 'Не задана',
  /** Choices in the details panel, in minutes. */
  options: [15, 30, 45, 60, 90, 120, 180, 240],
} as const;

export const TIMELINE_TEXTS = {
  region: 'Таймлайн дня',
  tab: 'Таймлайн',
  today: 'Сегодня',
  now: 'Сейчас',
  untimed: 'Без времени',
  empty: 'На этот день нет задач со временем.',
  count: (count: number) => TEXTS.taskCount(count),
  planned: (total: string) => `запланировано ${total}`,
} as const;

export const UNDO_TEXTS = {
  undo: 'Отменить',
  added: 'Добавлено',
  reopened: (title: string) => `Возвращено: «${title}»`,
  changed: 'Изменено',
  dateChanged: 'Срок изменён',
  movedToTomorrow: 'Перенесено на завтра',
  movedToList: (name: string) => `Перемещено в «${name}»`,
  completed: (title: string) => `Выполнено: «${title}»`,
  deleted: (title: string) => `Удалено: «${title}»`,
  movedToToday: 'Перенесено на сегодня',
} as const;

export const LIST_ACTION_TEXTS = {
  actions: (name: string) => `Действия со списком ${name}`,
  rename: 'Переименовать',
  color: 'Цвет',
  delete: 'Удалить',
  cancel: 'Отмена',
  confirm: (name: string) => `Удалить список «${name}»?`,
  consequence: 'Задачи останутся, но без списка.',
  colors: {
    blue: 'Синий',
    brown: 'Коричневый',
    gray: 'Серый',
    green: 'Зелёный',
    red: 'Красный',
    olive: 'Оливковый',
  },
} as const;

export const STATS_TEXTS = {
  region: 'Итоги дня',
  done: (done: number, total: number) => `${String(done)} из ${String(total)}`,
  doneHint: 'выполнено',
  dueToday: 'на сегодня',
  dueThatDay: 'на этот день',
  overdue: 'просрочено',
  highPriority: 'высокий приоритет',
  important: 'важные',
} as const;

/** Greeting above the date, by the local hour: morning 5–11, day 12–17, evening otherwise. */
export function greeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Доброе утро';
  if (hour >= 12 && hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

/** Theme switch in the sidebar. */
export const THEME_TEXTS = {
  theme: 'Тема',
  themes: { light: 'Светлая', dark: 'Тёмная', system: 'Как в системе' },
} as const;

/** The «?» overlay with every shortcut. */
export const SHORTCUT_TEXTS = {
  help: 'Горячие клавиши',
  close: 'Закрыть',
  keyColumn: 'Клавиша',
  actionColumn: 'Действие',
  shortcutGroups: [
    {
      title: 'Навигация',
      rows: [
        ['N', 'Новая задача'],
        ['/', 'Поиск'],
        ['J / ↓', 'Следующая задача'],
        ['K / ↑', 'Предыдущая задача'],
        ['Enter', 'Открыть детали'],
        ['Esc', 'Снять выделение'],
      ],
    },
    {
      title: 'Задачи',
      rows: [
        ['X', 'Выполнить / вернуть'],
        ['E', 'Редактировать название'],
        ['Backspace / Delete', 'Удалить'],
        ['Alt + ↑ / ↓', 'Переместить в списке'],
        ['Пробел / Enter', 'Взять / поставить за ручку'],
        ['↑ / ↓', 'На таймлайне: 15 минут'],
        ['Shift + ↑ / ↓', 'На таймлайне: 60 минут'],
      ],
    },
    {
      title: 'Общие',
      rows: [
        ['Mod + K', 'Палитра команд'],
        ['Mod + Z', 'Отменить действие'],
        ['?', 'Горячие клавиши'],
      ],
    },
  ],
} as const;

/** The Ctrl/Cmd+K command palette. */
export const PALETTE_TEXTS = {
  palette: 'Палитра команд',
  commandPlaceholder: 'Команда или название задачи…',
  noCommands: 'Ничего не найдено',
  commands: 'Команды',
  actions: 'Действия',
  go: 'Перейти',
  task: 'Задача',
  tasks: 'Задачи',
  newTask: 'Новая задача',
  search: 'Поиск',
  complete: 'Выполнить',
  reopen: 'Вернуть',
  today: 'На сегодня',
  tomorrow: 'На завтра',
  tomorrowView: 'Завтра',
  delete: 'Удалить',
} as const;

/** Drag & drop: handles and screen reader announcements (list and timeline). */
export const DRAG_TEXTS = {
  sortable: 'Сортируемая задача',
  draggable: 'Перемещаемый блок задачи',
  dragHandle: (title: string) => `Переместить «${title}»`,
  dragInstructions:
    'Чтобы взять задачу, нажмите Пробел или Enter. Стрелки вверх и вниз меняют порядок внутри группы. Пробел или Enter — поставить, Escape — отменить.',
  dragStart: (title: string) => `Взята задача «${title}».`,
  dragOver: (title: string, position: number, total: number) =>
    `«${title}»: позиция ${String(position)} из ${String(total)}.`,
  dragEnd: (title: string) => `Задача «${title}» перемещена.`,
  dragCancel: 'Перемещение отменено.',
  timelineInstructions:
    'Стрелки вверх и вниз — перенести на 15 минут, с Shift — на час. Мышью тяните блок по вертикали, на сенсорном экране удерживайте перед переносом.',
} as const;

/** Toasts after a task is moved to another time or day. */
export const MOVE_TEXTS = {
  movedTime: (time: string) => `Перенесено на ${time}`,
  movedDate: (day: string) => `Перенесено на ${day}`,
} as const;
