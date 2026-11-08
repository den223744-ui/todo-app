import type { SmartList } from '../domain/smartLists';
import type { QuickAddIssue } from '../domain/quickAddInput';

/** All UI texts (AGENTS.md: Russian UI texts live in constants). */
export const TEXTS = {
  appTitle: 'Задачи',
  navigation: 'Навигация',
  openMenu: 'Открыть меню',
  closeMenu: 'Закрыть меню',
  smartLists: 'Списки',
  tags: 'Теги',
  tagsEmpty: 'Добавьте к задаче #тег — он появится здесь.',
  quickAdd: 'Новая задача',
  quickAddPlaceholder: 'Купить молоко завтра в 18:00 #дом !!',
  quickAddHint: 'Enter — добавить. Даты, #теги и !приоритет распознаются автоматически.',
  quickAddSubmit: 'Добавить',
  quickAddSuccess: 'Задача добавлена.',
  quickAddError: (title: string) => `Не удалось создать задачу «${title}». Попробуйте ещё раз.`,
  taskList: 'Список задач',
  loadingTasks: 'Загружаем задачи…',
  loadTasksError: 'Не удалось загрузить задачи.',
  refreshTasksError: 'Не удалось обновить список. Показаны сохранённые данные.',
  updateTaskError: 'Не удалось изменить задачу. Изменение отменено.',
  retry: 'Повторить',
  dismissError: 'Закрыть сообщение',
  searchEmpty: 'Ничего не найдено',
  searchEmptyHint: 'Попробуйте другой запрос или выберите другой список.',
  tagEmpty: 'В этом теге пока нет задач',
  tagEmptyHint: 'Здесь появятся невыполненные задачи с этим тегом.',
  completeTask: (title: string) => `Выполнить: ${title}`,
  reopenTask: (title: string) => `Вернуть в работу: ${title}`,
  taskCount: (count: number) => `${String(count)} ${plural(count, 'задача', 'задачи', 'задач')}`,
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
export function plural(count: number, one: string, few: string, many: string): string {
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
