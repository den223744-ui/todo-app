import type { SmartList } from '../domain/smartLists';

/** All UI texts (AGENTS.md: Russian UI texts live in constants). */
export const TEXTS = {
  appTitle: 'Задачи',
  navigation: 'Навигация',
  openMenu: 'Открыть меню',
  closeMenu: 'Закрыть меню',
  smartLists: 'Списки',
  tags: 'Теги',
  tagsEmpty: 'Добавьте к задаче #тег — он появится здесь.',
  taskCount: (count: number) => `${String(count)} ${plural(count, 'задача', 'задачи', 'задач')}`,
} as const;

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
