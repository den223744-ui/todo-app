// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../App';
import { api } from '../../api';
import type { TaskRead } from '../../api/schema';
import { makeTask } from '../../test/makeTask';
import { makeList } from '../../test/makeList';
import { renderWithClient } from '../../test/renderWithClient';
import { useToastStore } from '../../store/toastStore';
import { useUiStore } from '../../store/uiStore';
import { taskKeys } from './taskQueries';
import { UNDO_MS } from './useTaskActions';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function open(initial: TaskRead[] = [], url = '/?list=inbox') {
  window.history.replaceState(null, '', url);
  let saved = [...initial];
  vi.spyOn(api, 'listTasks').mockImplementation(() => Promise.resolve(saved));
  const remove = vi.spyOn(api, 'deleteTask').mockImplementation((id) => {
    saved = saved.filter((task) => task.id !== id && task.parent_id !== id);
    return Promise.resolve();
  });
  const update = vi.spyOn(api, 'updateTask').mockImplementation((id, { completed, ...patch }) => {
    saved = saved.map((task) =>
      task.id === id
        ? {
            ...task,
            ...patch,
            ...(completed === undefined
              ? {}
              : { completed_at: completed ? '2026-02-03T12:00:00Z' : null }),
          }
        : task,
    );
    return Promise.resolve(saved.find((task) => task.id === id) as TaskRead);
  });
  const result = renderWithClient(<App />, saved, [makeList({ id: 'work', name: 'Работа' })]);
  return {
    ...result,
    remove,
    update,
    save: (task: TaskRead) => {
      saved.push(task);
    },
  };
}

describe('undo and focus after actions', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    useToastStore.setState({ toasts: [] });
    useUiStore.setState({
      paletteOpen: false,
      helpOpen: false,
      drawerOpen: false,
      dragging: false,
      selectedTaskId: null,
      editingTaskId: null,
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['button', 'keyboard'])(
    'undo before POST resolves (%s) waits for the saved id and never reopens the toast',
    async (via) => {
      const response = deferred<TaskRead>();
      vi.spyOn(api, 'createTask').mockReturnValue(response.promise);
      const { queryClient, remove, save } = open();
      const input = screen.getByRole('textbox', { name: 'Новая задача' });
      await userEvent.type(input, 'Молоко{Enter}');
      expect(input).toHaveFocus();
      expect(screen.getByText('Добавлено')).toBeVisible();
      expect(useToastStore.getState().toasts[0]?.duration).toBe(UNDO_MS);
      const optimistic = await screen.findByText('Молоко');
      expect(optimistic.closest('[data-task-row]')).toHaveAttribute(
        'data-task-row',
        expect.stringContaining('optimistic-'),
      );
      if (via === 'button') await userEvent.click(screen.getByRole('button', { name: 'Отменить' }));
      else await userEvent.keyboard('{Control>}z{/Control}');
      expect(remove).not.toHaveBeenCalled();
      const saved = makeTask({ id: 'real', title: 'Молоко' });
      save(saved);
      act(() => {
        response.resolve(saved);
      });
      await waitFor(() => {
        expect(remove).toHaveBeenCalledExactlyOnceWith('real');
      });
      await waitFor(() => {
        expect(queryClient.getQueryData<TaskRead[]>(taskKeys.list())).toEqual([]);
      });
      expect(useToastStore.getState().toasts).toEqual([]);
      queryClient.clear();
    },
  );

  it('failed POST after early undo never deletes anything and restores the draft', async () => {
    const response = deferred<TaskRead>();
    vi.spyOn(api, 'createTask').mockReturnValue(response.promise);
    const { queryClient, remove } = open();
    const input = screen.getByRole('textbox', { name: 'Новая задача' });
    await userEvent.type(input, 'Черновик{Enter}');
    await userEvent.keyboard('{Meta>}z{/Meta}');
    act(() => {
      response.reject(new Error('POST failed'));
    });
    await waitFor(() => expect(input).toHaveValue('Черновик'));
    expect(remove).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts.every((toast) => !toast.action?.undo)).toBe(true);
    queryClient.clear();
  });

  it('server id replacement preserves the optimistic row DOM identity', async () => {
    const response = deferred<TaskRead>();
    vi.spyOn(api, 'createTask').mockReturnValue(response.promise);
    const { queryClient, save } = open();
    await userEvent.type(screen.getByRole('textbox', { name: 'Новая задача' }), 'Один раз{Enter}');
    const row = (await screen.findByText('Один раз')).closest('li');
    const saved = makeTask({ id: 'saved', title: 'Один раз' });
    save(saved);
    act(() => {
      response.resolve(saved);
    });
    expect((await screen.findByRole('link', { name: 'Один раз' })).closest('li')).toBe(row);
    expect(screen.getAllByRole('button', { name: 'Отменить' })).toHaveLength(1);
    queryClient.clear();
  });

  it('subtask creation offers undo immediately, including while the parent details stay open', async () => {
    const response = deferred<TaskRead>();
    vi.spyOn(api, 'createTask').mockReturnValue(response.promise);
    const { queryClient, remove, save } = open(
      [makeTask({ id: 'p', title: 'Проект' })],
      '/?list=inbox&task=p',
    );
    const input = screen.getByRole('textbox', { name: 'Новая подзадача' });
    await userEvent.type(input, 'Шаг{Enter}');
    expect(input).toHaveFocus();
    await userEvent.keyboard('{Control>}z{/Control}');
    const subtask = makeTask({ id: 'child', parent_id: 'p', title: 'Шаг' });
    save(subtask);
    act(() => {
      response.resolve(subtask);
    });
    await waitFor(() => {
      expect(remove).toHaveBeenCalledExactlyOnceWith('child');
    });
    expect(screen.getByRole('heading', { name: 'Детали задачи' })).toBeInTheDocument();
    queryClient.clear();
  });

  it('date clearing restores date and time; list changes restore only the list', async () => {
    const task = makeTask({
      id: 'p',
      title: 'Проект',
      due_date: '2026-02-03',
      due_time: '09:30:00',
    });
    const { queryClient, update } = open([task], '/?task=p');
    await userEvent.click(screen.getByRole('button', { name: 'Убрать дату' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    await waitFor(() => {
      expect(update).toHaveBeenLastCalledWith('p', {
        due_date: '2026-02-03',
        due_time: '09:30:00',
      });
    });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Список' }), 'work');
    expect(screen.getByText('Перемещено в «Работа»')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    await waitFor(() => {
      expect(update).toHaveBeenLastCalledWith('p', { list_id: null });
    });
    queryClient.clear();
  });

  it('palette navigation focuses the destination h1; closing help returns to its trigger', async () => {
    const { queryClient } = open();
    const trigger = screen.getByRole('button', { name: /Горячие клавиши/ });
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.keyboard('{Control>}k{/Control}');
    await userEvent.click(screen.getByRole('option', { name: 'Предстоящие' }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Предстоящие' })).toHaveFocus(),
    );
    queryClient.clear();
  });

  it('day navigation preserves its button and focus across the animated day change', async () => {
    const { queryClient } = open([], '/');
    const next = screen.getByRole('button', { name: 'Следующий день' });
    await userEvent.click(next);
    expect(screen.getByRole('button', { name: 'Следующий день' })).toBe(next);
    expect(next).toHaveFocus();
    await userEvent.click(next);
    expect(next).toHaveFocus();
    queryClient.clear();
  });

  it('the exiting list retains its filters and is inert while the new view appears', () => {
    const { queryClient } = open([makeTask({ id: 'inbox', title: 'Записи' })]);
    const link = screen.getByRole('link', { name: 'Записи' });
    const frame = link.closest('[data-view-transition]');
    fireEvent.click(screen.getByRole('link', { name: /^Предстоящие/ }));
    expect(frame).toHaveAttribute('aria-hidden', 'true');
    expect((frame as HTMLElement).inert).toBe(true);
    expect(frame?.querySelector('[data-task-link="inbox"]')).toBe(link);
    expect(screen.queryByRole('link', { name: 'Записи' })).toBeNull();
    queryClient.clear();
  });

  it('Show keeps Undo; undoing the creation closes its open details and focuses quick add', async () => {
    const response = deferred<TaskRead>();
    vi.spyOn(api, 'createTask').mockReturnValue(response.promise);
    const { queryClient, save, remove } = open();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Новая задача' }),
      'Новое дело завтра{Enter}',
    );
    const created = makeTask({ id: 'new', title: 'Новое дело', due_date: '2099-02-03' });
    save(created);
    act(() => {
      response.resolve(created);
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Показать' }));
    expect(screen.getByRole('heading', { name: 'Детали задачи' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    await waitFor(() => {
      expect(remove).toHaveBeenCalledExactlyOnceWith('new');
    });
    expect(window.location.search).not.toContain('task=');
    expect(screen.queryByRole('heading', { name: 'Детали задачи' })).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Новая задача' })).toHaveFocus();
    });
    queryClient.clear();
  });
});
