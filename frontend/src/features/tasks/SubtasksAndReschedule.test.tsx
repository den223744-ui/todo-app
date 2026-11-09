// @vitest-environment jsdom
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../api';
import type { TaskRead } from '../../api/schema';
import { toLocalDateString, addDays } from '../../domain/dates';
import { useToastStore } from '../../store/toastStore';
import { useUiStore } from '../../store/uiStore';
import { makeTask } from '../../test/makeTask';
import { renderWithClient } from '../../test/renderWithClient';
import { navigateTo } from '../navigation/useAppLocation';
import { Toaster } from '../toasts/Toaster';

import { TaskListContainer } from './TaskListContainer';
import { taskKeys } from './taskQueries';

const now = new Date(2026, 10, 9, 12);
const today = toLocalDateString(now);
const yesterday = toLocalDateString(addDays(now, -1));
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function open(tasks: TaskRead[], url = '/?list=inbox') {
  window.history.replaceState(null, '', url);
  let saved = tasks;
  vi.spyOn(api, 'listTasks').mockImplementation(() => Promise.resolve(saved));
  const update = vi.spyOn(api, 'updateTask').mockImplementation((id, { completed, ...patch }) => {
    saved = saved.map((task) =>
      task.id === id
        ? {
            ...task,
            ...patch,
            ...(completed === undefined
              ? {}
              : { completed_at: completed ? now.toISOString() : null }),
          }
        : task,
    );
    const task = saved.find((item) => item.id === id);
    return task ? Promise.resolve(task) : Promise.reject(new Error('missing task'));
  });
  return {
    ...renderWithClient(
      <>
        <TaskListContainer />
        <Toaster />
      </>,
      tasks,
    ),
    update,
  };
}

describe('inline subtasks and rescheduling', () => {
  beforeEach(() => {
    vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(now);
    useUiStore.setState({ expandedTaskIds: new Set(), editingTaskId: null });
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('expands by keyboard, toggles a subtask optimistically, locks pending writes and rolls back', async () => {
    const parent = makeTask({ id: 'p', title: 'Проект' });
    const child = makeTask({ id: 'c', title: 'Шаг', parent_id: 'p' });
    const unsaved = makeTask({ id: 'optimistic-1', title: 'Сохраняется', parent_id: 'p' });
    const done = makeTask({
      id: 'd',
      title: 'Готово',
      parent_id: 'p',
      completed_at: now.toISOString(),
    });
    const { queryClient, update } = open([parent, child, unsaved, done]);
    const request = deferred<TaskRead>();
    update.mockImplementationOnce(() => request.promise);
    const trigger = screen.getByRole('button', { name: /показать подзадачи: Проект$/ });
    expect(trigger).toHaveTextContent('1/3');
    expect(screen.queryByRole('checkbox', { name: 'Выполнить: Шаг' })).toBeNull();
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const children = screen.getByRole('list', { name: 'Подзадачи: Проект' });
    expect(children).toHaveAttribute('id', trigger.getAttribute('aria-controls'));
    expect(within(children).getByText('Готово')).toHaveClass('line-through');
    const checkbox = within(children).getByRole('checkbox', { name: 'Выполнить: Шаг' });
    await userEvent.click(checkbox);
    await waitFor(() => {
      expect(checkbox).toBeChecked();
      expect(checkbox).toHaveAttribute('aria-disabled', 'true');
    });
    expect(trigger).toHaveTextContent('2/3');
    await userEvent.click(checkbox);
    await userEvent.click(
      within(children).getByRole('checkbox', { name: 'Выполнить: Сохраняется' }),
    );
    expect(update).toHaveBeenCalledTimes(1);
    await act(async () => {
      request.reject(new Error('refused'));
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(checkbox).not.toBeChecked();
      expect(checkbox).not.toHaveAttribute('aria-disabled');
    });
    expect(trigger).toHaveTextContent('1/3');
    await userEvent.click(trigger);
    await waitFor(() => {
      expect(screen.queryByRole('list', { name: 'Подзадачи: Проект' })).toBeNull();
    });
    expect(trigger).toHaveFocus();
    queryClient.clear();
  });

  it('keeps an expanded parent when the view changes and persists a successful subtask toggle', async () => {
    const tasks = [
      makeTask({ id: 'p', title: 'Проект', due_date: today }),
      makeTask({ id: 'c', parent_id: 'p', title: 'Шаг' }),
    ];
    const { queryClient, update } = open(tasks, '/');
    await userEvent.click(screen.getByRole('button', { name: /показать подзадачи: Проект$/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Выполнить: Шаг' }));
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith('c', { completed: true });
    });
    expect(await screen.findByRole('checkbox', { name: 'Вернуть в работу: Шаг' })).toBeChecked();
    act(() => {
      navigateTo({ view: { kind: 'list', list: 'inbox' } });
    });
    act(() => {
      navigateTo({ view: { kind: 'list', list: 'today' } });
    });
    expect(screen.getByRole('button', { name: /скрыть подзадачи: Проект$/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(useUiStore.getState().expandedTaskIds.has('p')).toBe(true);
    queryClient.clear();
  });

  it('moves one overdue task, keeps time and lets undo restore the old date', async () => {
    const late = makeTask({
      id: 'late',
      title: 'Отчёт',
      due_date: yesterday,
      due_time: '18:30:00',
    });
    const { queryClient, update } = open([late], '/');
    await userEvent.click(screen.getByRole('button', { name: 'Перенести на сегодня: Отчёт' }));
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith('late', { due_date: today });
    });
    expect(queryClient.getQueryData<TaskRead[]>(taskKeys.list())?.[0]).toMatchObject({
      due_date: today,
      due_time: '18:30:00',
    });
    expect(screen.queryByRole('button', { name: 'Перенести на сегодня: Отчёт' })).toBeNull();
    expect(screen.getByText('Перенесено на сегодня')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    await waitFor(() => {
      expect(update).toHaveBeenLastCalledWith('late', { due_date: yesterday });
    });
    expect(queryClient.getQueryData<TaskRead[]>(taskKeys.list())?.[0]?.due_time).toBe('18:30:00');
    queryClient.clear();
  });

  it('moves the whole overdue set with one undo, excluding completed and child tasks', async () => {
    const tasks = [
      makeTask({ id: 'a', title: 'A', due_date: yesterday }),
      makeTask({ id: 'b', title: 'B', due_date: toLocalDateString(addDays(now, -2)) }),
      makeTask({ id: 'c', parent_id: 'a', due_date: yesterday }),
      makeTask({ id: 'd', due_date: yesterday, completed_at: now.toISOString() }),
    ];
    const { queryClient, update } = open(tasks, '/?list=overdue');
    await userEvent.click(screen.getByRole('button', { name: 'Перенести все на сегодня (2)' }));
    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(2);
    });
    expect(screen.getAllByRole('button', { name: 'Отменить' })).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(4);
    });
    expect(update.mock.calls).toContainEqual(['a', { due_date: yesterday }]);
    expect(update.mock.calls).toContainEqual([
      'b',
      { due_date: toLocalDateString(addDays(now, -2)) },
    ]);
    expect(
      await screen.findByRole('button', { name: 'Перенести все на сегодня (2)' }),
    ).toBeInTheDocument();
    queryClient.clear();
  });

  it('undo during a pending batch waits for each write and excludes failed ones', async () => {
    const tasks = [
      makeTask({ id: 'a', due_date: yesterday }),
      makeTask({ id: 'b', due_date: yesterday }),
    ];
    const { queryClient, update } = open(tasks, '/?list=overdue');
    const first = deferred<TaskRead>();
    const second = deferred<TaskRead>();
    update.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    await userEvent.click(screen.getByRole('button', { name: 'Перенести все на сегодня (2)' }));
    await userEvent.click(screen.getByRole('button', { name: 'Отменить' }));
    act(() => {
      first.resolve({ ...(tasks[0] as TaskRead), due_date: today });
      second.reject(new Error('failed'));
    });
    await waitFor(() => {
      expect(update).toHaveBeenCalledTimes(3);
    });
    expect(update).toHaveBeenLastCalledWith('a', { due_date: yesterday });
    queryClient.clear();
  });

  it('withdraws the undo toast and restores the row when rescheduling fails', async () => {
    const { queryClient, update } = open(
      [makeTask({ id: 'a', title: 'Отчёт', due_date: yesterday })],
      '/?list=overdue',
    );
    update.mockRejectedValueOnce(new Error('failed'));
    await userEvent.click(screen.getByRole('button', { name: 'Перенести на сегодня: Отчёт' }));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Отменить' })).toBeNull();
    });
    expect(
      await screen.findByRole('button', { name: 'Перенести на сегодня: Отчёт' }),
    ).toBeInTheDocument();
    queryClient.clear();
  });

  it('uses short headings and time only in day groups; search keeps dates', async () => {
    const tasks = [
      makeTask({ id: 'a', due_date: toLocalDateString(addDays(now, 1)), due_time: '10:00:00' }),
      makeTask({ id: 'b', due_date: toLocalDateString(addDays(now, 2)) }),
      makeTask({ id: 'c', due_date: toLocalDateString(addDays(now, 3)) }),
    ];
    const { queryClient, container } = open(tasks, '/?list=upcoming');
    expect(screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)).toEqual([
      'Завтра',
      'Послезавтра',
      'Чт, 12 нояб.',
    ]);
    expect([...container.querySelectorAll('time')].map((node) => node.textContent)).toEqual([
      '10:00',
    ]);
    act(() => {
      navigateTo({ query: 'a' });
    });
    await waitFor(() => {
      expect(container.querySelector('time')).toHaveTextContent('10 нояб., 10:00');
    });
    queryClient.clear();
  });
});
