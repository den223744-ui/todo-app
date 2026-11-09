// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';

import { api } from '../../api';
import { toLocalDateString } from '../../domain/dates';
import { makeTask } from '../../test/makeTask';
import { renderWithClient } from '../../test/renderWithClient';
import { Toaster } from '../toasts/Toaster';

import { TaskListContainer } from './TaskListContainer';

afterEach(() => {
  vi.restoreAllMocks();
});

it('shows after completion and disappears on Undo, retaining the completed row', async () => {
  const now = new Date();
  const task = makeTask({ id: 'last', title: 'Последнее дело', due_date: toLocalDateString(now) });
  let stored = task;
  vi.spyOn(api, 'updateTask').mockImplementation((_id, patch) => {
    stored = { ...task, completed_at: patch.completed ? now.toISOString() : null };
    return Promise.resolve(stored);
  });
  vi.spyOn(api, 'listTasks').mockImplementation(() => Promise.resolve([stored]));
  const { queryClient } = renderWithClient(
    <>
      <TaskListContainer />
      <Toaster />
    </>,
    [task],
  );
  expect(screen.queryByText('Все дела на сегодня сделаны')).toBeNull();
  await userEvent.click(screen.getByRole('checkbox', { name: 'Выполнить: Последнее дело' }));
  expect(await screen.findByText('Все дела на сегодня сделаны')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Последнее дело/ })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Без списка' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'Отменить' }));
  await waitFor(() => {
    expect(screen.queryByText('Все дела на сегодня сделаны')).toBeNull();
  });
  expect(screen.getByRole('checkbox', { name: 'Выполнить: Последнее дело' })).not.toBeChecked();
  queryClient.clear();
});

it('reverts the celebration when completing the last task fails', async () => {
  const task = makeTask({ id: 'last', title: 'Дело', due_date: toLocalDateString(new Date()) });
  let reject!: (reason: Error) => void;
  vi.spyOn(api, 'updateTask').mockImplementation(
    () =>
      new Promise((_resolve, fail) => {
        reject = fail;
      }),
  );
  vi.spyOn(api, 'listTasks').mockResolvedValue([task]);
  const { queryClient } = renderWithClient(<TaskListContainer />, [task]);
  await userEvent.click(screen.getByRole('checkbox', { name: 'Выполнить: Дело' }));
  expect(await screen.findByText('Все дела на сегодня сделаны')).toBeInTheDocument();
  reject(new Error('offline'));
  await waitFor(() => {
    expect(screen.queryByText('Все дела на сегодня сделаны')).toBeNull();
  });
  expect(screen.getByRole('heading', { name: 'Без списка' })).toBeInTheDocument();
  queryClient.clear();
});
