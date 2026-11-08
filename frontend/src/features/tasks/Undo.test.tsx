// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../api';
import { ApiError } from '../../api/client';
import type { TaskRead } from '../../api/schema';
import { App } from '../../App';
import { useToastStore } from '../../store/toastStore';
import { makeTask } from '../../test/makeTask';
import { renderWithClient } from '../../test/renderWithClient';

const TASK = makeTask({ id: 't1', title: 'Полить цветы' });
const SUB = makeTask({ id: 's1', title: 'Кактус', parent_id: 't1' });

/** The app over an in-memory server that applies writes, so refetches agree. */
function openApp(search = '/?list=inbox') {
  window.history.replaceState(null, '', search);
  let store: TaskRead[] = [TASK, SUB];
  vi.spyOn(api, 'listTasks').mockImplementation(() => Promise.resolve(store));
  const update = vi.spyOn(api, 'updateTask').mockImplementation((id, patch) => {
    store = store.map((task) =>
      task.id === id && patch.completed !== undefined
        ? { ...task, completed_at: patch.completed ? '2026-11-09T10:00:00Z' : null }
        : task,
    );
    return Promise.resolve(store.find((task) => task.id === id) as TaskRead);
  });
  const remove = vi.spyOn(api, 'deleteTask').mockImplementation((id) => {
    store = store.filter((task) => task.id !== id && task.parent_id !== id);
    return Promise.resolve();
  });
  const restore = vi.spyOn(api, 'restoreTask').mockImplementation((id) => {
    store = [TASK, SUB];
    return Promise.resolve(store.find((task) => task.id === id) as TaskRead);
  });
  const result = renderWithClient(<App />, [TASK, SUB]);
  const toasts = screen.getByRole('region', { name: 'Уведомления' });
  return { ...result, update, remove, restore, toasts };
}

describe('undo', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('a completion can be undone from its toast', async () => {
    const { update, toasts, queryClient } = openApp();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Выполнить: Полить цветы' }));
    expect(await within(toasts).findByText('Выполнено: «Полить цветы»')).toBeInTheDocument();
    await userEvent.click(within(toasts).getByRole('button', { name: 'Отменить' }));

    await waitFor(() => {
      expect(update.mock.calls).toEqual([
        ['t1', { completed: true }],
        ['t1', { completed: false }],
      ]);
    });
    expect(within(toasts).queryByText('Выполнено: «Полить цветы»')).toBeNull();
    queryClient.clear();
  });

  it('reopening a task offers no undo', async () => {
    const done = makeTask({ id: 'd1', title: 'Готово', completed_at: '2026-11-09T09:00:00Z' });
    window.history.replaceState(null, '', '/?list=completed');
    vi.spyOn(api, 'listTasks').mockResolvedValue([done]);
    vi.spyOn(api, 'updateTask').mockResolvedValue({ ...done, completed_at: null });
    const { queryClient } = renderWithClient(<App />, [done]);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Вернуть в работу: Готово' }));

    expect(screen.queryByRole('button', { name: 'Отменить' })).toBeNull();
    queryClient.clear();
  });

  it('Ctrl+Z brings a deleted task back with its subtasks', async () => {
    const { remove, restore, queryClient } = openApp('/?list=inbox&task=t1');

    await userEvent.click(screen.getByRole('button', { name: 'Удалить задачу', exact: true }));
    await waitFor(() => {
      expect(remove).toHaveBeenCalledWith('t1');
    });
    expect(screen.queryByRole('checkbox', { name: 'Выполнить: Полить цветы' })).toBeNull();

    // Focus went to quick add (nothing left in the list); it is empty, so Ctrl+Z is ours.
    await userEvent.keyboard('{Control>}z{/Control}');

    await waitFor(() => {
      expect(restore).toHaveBeenCalledWith('t1');
    });
    expect(
      await screen.findByRole('checkbox', { name: 'Выполнить: Полить цветы' }),
    ).toBeInTheDocument();
    queryClient.clear();
  });

  it('Ctrl+Z in a field with text stays the field’s own undo', async () => {
    const { restore, queryClient } = openApp('/?list=inbox&task=t1');
    await userEvent.click(screen.getByRole('button', { name: 'Удалить задачу', exact: true }));

    await userEvent.type(screen.getByRole('textbox', { name: 'Новая задача' }), 'черновик');
    await userEvent.keyboard('{Control>}z{/Control}');

    expect(restore).not.toHaveBeenCalled();
    queryClient.clear();
  });

  it('a failed completion withdraws its undo offer and rolls back', async () => {
    const { update, toasts, queryClient } = openApp();
    update.mockRejectedValueOnce(new ApiError(500, 'internal_error', 'boom'));

    await userEvent.click(screen.getByRole('checkbox', { name: 'Выполнить: Полить цветы' }));

    await waitFor(() => {
      expect(within(toasts).queryByRole('button', { name: 'Отменить' })).toBeNull();
    });
    expect(
      await screen.findByRole('checkbox', { name: 'Выполнить: Полить цветы' }),
    ).not.toBeChecked();
    queryClient.clear();
  });
});
