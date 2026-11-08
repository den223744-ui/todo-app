// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../api';
import { createQueryClient } from '../../api/queryClient';
import type { TaskRead } from '../../api/schema';
import { EMPTY_LIST_TEXTS, TEXTS } from '../../constants/texts';
import { SMART_LISTS } from '../../domain/smartLists';
import { navigateTo } from '../navigation/useAppLocation';
import { makeTask } from '../../test/makeTask';
import { renderWithClient } from '../../test/renderWithClient';
import { taskKeys } from './taskQueries';
import { TaskListContainer } from './TaskListContainer';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('TaskListContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 8, 12));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('renders today as two groups, with overdue first and full task metadata', () => {
    renderWithClient(<TaskListContainer />, [
      makeTask({ id: 'today', due_date: '2026-11-08' }),
      makeTask({
        id: 'late',
        title: 'Отправить отчёт',
        due_date: '2026-11-07',
        due_time: '18:30:00',
        priority: 3,
        tags: ['работа'],
      }),
      makeTask({ id: 'future', due_date: '2026-11-09' }),
      makeTask({ id: 'child', parent_id: 'today', due_date: '2026-11-08' }),
    ]);
    expect(screen.getAllByRole('heading', { level: 2 }).map((node) => node.textContent)).toEqual([
      'Просроченные',
      'Сегодня',
    ]);
    const late = screen.getByRole('region', { name: 'Просроченные' });
    expect(within(late).getByText('Высокий приоритет')).toBeInTheDocument();
    expect(within(late).getByText('#работа')).toBeInTheDocument();
    expect(late.querySelector('time')).toHaveAttribute('datetime', '2026-11-07T18:30:00');
    expect(late.querySelector('time')).toHaveTextContent('18:30');
    expect(late.querySelector('time')).toHaveClass('text-danger');
    expect(screen.queryByRole('link', { name: /future|child/ })).not.toBeInTheDocument();
  });

  it('renders upcoming dates in order with one heading per day', () => {
    window.history.replaceState(null, '', '/?list=upcoming');
    renderWithClient(<TaskListContainer />, [
      makeTask({ id: 'later', due_date: '2026-11-10' }),
      makeTask({ id: 'earlier', due_date: '2026-11-09' }),
    ]);
    const headings = screen.getAllByRole('heading', { level: 2 });
    expect(headings[0]).toHaveTextContent('9 ноября');
    expect(headings[1]).toHaveTextContent('10 ноября');
    expect(screen.getAllByRole('link').map((node) => node.textContent)).toEqual([
      expect.stringContaining('earlier'),
      expect.stringContaining('later'),
    ]);
  });

  it.each(SMART_LISTS)('has a dedicated empty state for %s', (list) => {
    window.history.replaceState(null, '', `/?list=${list}`);
    renderWithClient(<TaskListContainer />);
    expect(screen.getByRole('status')).toHaveTextContent(EMPTY_LIST_TEXTS[list].title);
  });

  it('has a tag empty state, and search takes precedence', () => {
    window.history.replaceState(null, '', '/?tag=дом');
    renderWithClient(<TaskListContainer />);
    expect(screen.getByRole('status')).toHaveTextContent(TEXTS.tagEmpty);
    act(() => {
      navigateTo({ query: 'запрос' });
    });
    expect(screen.getByRole('status')).toHaveTextContent(TEXTS.searchEmpty);
  });

  it('combines the tag and search from the URL and reacts to history navigation', async () => {
    window.history.replaceState(null, '', '/?tag=дом&q=молоко');
    renderWithClient(<TaskListContainer />, [
      makeTask({ id: 'milk', title: 'Купить молоко', tags: ['дом'] }),
      makeTask({ id: 'bread', title: 'Купить хлеб', tags: ['дом'] }),
      makeTask({ id: 'other', title: 'Молоко для офиса', tags: ['работа'] }),
    ]);
    expect(screen.getByRole('link', { name: /Купить молоко/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /хлеб|офиса/ })).not.toBeInTheDocument();
    act(() => {
      window.history.replaceState(null, '', '/?tag=дом');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(await screen.findByRole('link', { name: /Купить хлеб/ })).toBeInTheDocument();
  });

  it('opens a task in the URL while preserving view and search', async () => {
    window.history.replaceState(null, '', '/?list=inbox&q=задача');
    renderWithClient(<TaskListContainer />, [makeTask({ id: 't1', title: 'Задача' })]);
    const link = screen.getByRole('link', { name: 'Задача' });
    expect(link).toHaveAttribute(
      'href',
      '?list=inbox&q=%D0%B7%D0%B0%D0%B4%D0%B0%D1%87%D0%B0&task=t1',
    );
    await userEvent.click(link);
    expect(new URLSearchParams(window.location.search).get('task')).toBe('t1');
    expect(link).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('shows skeletons until the first response, without a false empty state', async () => {
    const response = deferred<TaskRead[]>();
    vi.spyOn(api, 'listTasks').mockReturnValue(response.promise);
    const client = createQueryClient();
    render(
      <QueryClientProvider client={client}>
        <TaskListContainer />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('status', { name: TEXTS.loadingTasks })).toBeInTheDocument();
    expect(screen.queryByText(EMPTY_LIST_TEXTS.today.title)).not.toBeInTheDocument();
    act(() => {
      response.resolve([]);
    });
    expect(await screen.findByText(EMPTY_LIST_TEXTS.today.title)).toBeInTheDocument();
    client.clear();
  });

  it('shows a first-load error and retries successfully', async () => {
    const request = vi
      .spyOn(api, 'listTasks')
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue([]);
    const client = createQueryClient();
    client.setDefaultOptions({ queries: { retry: false } });
    render(
      <QueryClientProvider client={client}>
        <TaskListContainer />
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTS.loadTasksError);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: TEXTS.retry }));
    expect(await screen.findByText(EMPTY_LIST_TEXTS.today.title)).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(2);
    client.clear();
  });

  it('keeps cached tasks visible when a background refresh fails', async () => {
    window.history.replaceState(null, '', '/?list=inbox');
    vi.spyOn(api, 'listTasks').mockRejectedValue(new Error('offline'));
    const { queryClient } = renderWithClient(<TaskListContainer />, [makeTask({ id: 'cached' })]);
    queryClient.setDefaultOptions({ queries: { retry: false } });
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: taskKeys.list() });
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTS.refreshTasksError);
    expect(screen.getByRole('link', { name: 'cached' })).toBeInTheDocument();
    queryClient.clear();
  });

  it('optimistically completes a task and restores it on failure', async () => {
    window.history.replaceState(null, '', '/?list=inbox');
    const response = deferred<TaskRead>();
    const task = makeTask({ id: 't1', title: 'Сделать тесты' });
    const update = vi.spyOn(api, 'updateTask').mockReturnValue(response.promise);
    vi.spyOn(api, 'listTasks').mockResolvedValue([task]);
    const { queryClient } = renderWithClient(<TaskListContainer />, [task]);
    await userEvent.click(screen.getByRole('checkbox', { name: TEXTS.completeTask(task.title) }));
    await waitFor(() => {
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
    expect(update).toHaveBeenCalledWith('t1', { completed: true });
    expect(window.location.search).toBe('?list=inbox');
    act(() => {
      response.reject(new Error('offline'));
    });
    expect(await screen.findByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('alert')).toHaveTextContent(TEXTS.updateTaskError);
    await userEvent.click(screen.getByRole('button', { name: TEXTS.dismissError }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    queryClient.clear();
  });

  it('reopens a completed task and accepts the server response', async () => {
    window.history.replaceState(null, '', '/?list=completed');
    const task = makeTask({ id: 't1', title: 'Готово', completed_at: '2026-11-08T10:00:00Z' });
    const update = vi.spyOn(api, 'updateTask').mockResolvedValue({ ...task, completed_at: null });
    vi.spyOn(api, 'listTasks').mockResolvedValue([{ ...task, completed_at: null }]);
    const { queryClient } = renderWithClient(<TaskListContainer />, [task]);
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(screen.getByText('Готово')).toHaveClass('line-through');
    await userEvent.click(screen.getByRole('checkbox', { name: TEXTS.reopenTask(task.title) }));
    expect(await screen.findByText(EMPTY_LIST_TEXTS.completed.title)).toBeInTheDocument();
    expect(update).toHaveBeenCalledWith('t1', { completed: false });
    await waitFor(() => {
      expect(queryClient.isMutating()).toBe(0);
    });
    queryClient.clear();
  });
});
