import type { SmartList } from '../domain/smartLists';

/** All UI texts (AGENTS.md: Russian UI texts live in constants). */
export const TEXTS = {
  appTitle: 'Задачи',
  navigation: 'Навигация',
  openMenu: 'Открыть меню',
  closeMenu: 'Закрыть меню',
  smartLists: 'Списки',
  tags: 'Теги',
} as const;

export const LIST_TITLES: Record<SmartList, string> = {
  inbox: 'Входящие',
  today: 'Сегодня',
  upcoming: 'Предстоящие',
  overdue: 'Просроченные',
  completed: 'Выполненные',
};
