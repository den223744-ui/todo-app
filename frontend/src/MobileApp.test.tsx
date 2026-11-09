// @vitest-environment jsdom
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import { App } from './App';
import { toLocalDateString } from './domain/dates';
import { useUiStore } from './store/uiStore';
import { makeTask } from './test/makeTask';
import { renderWithClient } from './test/renderWithClient';

afterEach(() => {
  vi.unstubAllGlobals();
  useUiStore.setState({ dayView: 'list' });
});

it('shows one mobile search, shares Timeline through tabs, preserves the choice and drops tabs on desktop', async () => {
  let width = 375;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('767') ? width < 768 : query.includes('1023') && width < 1024,
    addEventListener: (_name: string, callback: () => void) => {
      listeners.add(callback);
    },
    removeEventListener: (_name: string, callback: () => void) => {
      listeners.delete(callback);
    },
  }));
  const task = makeTask({
    id: 'meeting',
    title: 'Встреча',
    due_date: toLocalDateString(new Date()),
    due_time: '10:00:00',
  });
  const { queryClient } = renderWithClient(<App />, [task]);
  expect(screen.queryByRole('searchbox')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Открыть поиск' }));
  expect(screen.getAllByRole('searchbox')).toHaveLength(1);
  await userEvent.click(screen.getByRole('button', { name: 'Закрыть поиск' }));
  await userEvent.click(screen.getByRole('tab', { name: 'Таймлайн' }));
  const panel = screen.getByRole('tabpanel', { name: 'Таймлайн' });
  expect(within(panel).getByRole('region', { name: 'Таймлайн дня' })).toBeInTheDocument();
  await userEvent.click(within(panel).getByRole('button', { name: /Встреча/ }));
  expect(screen.getByRole('dialog', { name: 'Детали задачи' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Закрыть детали' }));
  expect(screen.getByRole('tab', { name: 'Таймлайн' })).toHaveAttribute('aria-selected', 'true');
  await waitFor(() => {
    expect(within(panel).getByRole('button', { name: /Встреча/ })).toHaveFocus();
  });
  // Search still takes precedence while Timeline was the chosen mobile tab.
  await userEvent.click(screen.getByRole('button', { name: 'Открыть поиск' }));
  await userEvent.type(screen.getByRole('searchbox'), 'Встреча');
  expect(screen.queryByRole('tablist')).toBeNull();
  expect(
    within(screen.getByRole('main')).getByRole('link', { name: /Встреча/ }),
  ).toBeInTheDocument();
  await userEvent.keyboard('{Escape}');
  expect(screen.getByRole('tab', { name: 'Таймлайн' })).toHaveAttribute('aria-selected', 'true');
  await userEvent.keyboard('{Escape}');
  act(() => {
    width = 1440;
    for (const listener of listeners) listener();
  });
  expect(screen.queryByRole('tablist')).toBeNull();
  expect(screen.getAllByRole('searchbox')).toHaveLength(1);
  expect(screen.getByRole('region', { name: 'Таймлайн дня' })).toBeInTheDocument();
  queryClient.clear();
});
