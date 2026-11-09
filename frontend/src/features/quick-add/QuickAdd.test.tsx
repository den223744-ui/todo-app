// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../api';
import { createQueryClient } from '../../api/queryClient';
import type { TaskRead } from '../../api/schema';
import { App } from '../../App';
import { LIST_TITLES, QUICK_ADD_ISSUES, TEXTS } from '../../constants/texts';
import { parseLocation } from '../../domain/view';
import { useToastStore } from '../../store/toastStore';
import { makeList } from '../../test/makeList';
import { makeTask } from '../../test/makeTask';
import { renderWithClient } from '../../test/renderWithClient';
import { navigateTo } from '../navigation/useAppLocation';
import { taskKeys } from '../tasks/taskQueries';
import { QuickAdd } from './QuickAdd';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('QuickAdd', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 8, 12));
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('highlights token ranges in the original text, without treating HTML as markup', async () => {
    const { container } = renderWithClient(<QuickAdd />);
    const text = '<b>Молоко</b> завтра в 18:00 #дом !!';
    await userEvent.type(screen.getByRole('textbox', { name: TEXTS.quickAdd }), text);
    expect(screen.getByRole('textbox')).toHaveValue(text);
    expect(
      [...container.querySelectorAll('mark')].map((mark) => [
        mark.textContent,
        mark.getAttribute('data-token-kind'),
      ]),
    ).toEqual([
      ['завтра', 'date'],
      ['в 18:00', 'time'],
      ['#дом', 'tag'],
      ['!!', 'priority'],
    ]);
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('[aria-hidden="true"]')).toHaveTextContent(text);
  });

  it('leaves invalid dates as plain text and removes highlighting when edited', async () => {
    const { container } = renderWithClient(<QuickAdd />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Задача 31.02 !!!!');
    expect(container.querySelector('mark')).toBeNull();
    await userEvent.clear(input);
    await userEvent.type(input, 'Задача завтра');
    expect(container.querySelector('mark')).toHaveTextContent('завтра');
    await userEvent.clear(input);
    expect(container.querySelector('mark')).toBeNull();
  });

  it('creates a parsed task on Enter, clears the input and keeps focus', async () => {
    const created = makeTask({
      id: 't1',
      title: 'Купить молоко',
      due_date: '2026-11-09',
      due_time: '18:00:00',
      priority: 2,
      tags: ['дом'],
    });
    const request = vi.spyOn(api, 'createTask').mockResolvedValue(created);
    vi.spyOn(api, 'listTasks').mockResolvedValue([created]);
    const { queryClient } = renderWithClient(<QuickAdd />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Купить молоко завтра в 18:00 #дом !!{Enter}');
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
    expect(request).toHaveBeenCalledExactlyOnceWith({
      title: 'Купить молоко',
      due_date: '2026-11-09',
      due_time: '18:00',
      priority: 2,
      tags: ['дом'],
    });
    expect(input).toHaveFocus();
    await waitFor(() => {
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({
          message: TEXTS.quickAddAdded(LIST_TITLES.upcoming, 'пн, 9 нояб.'),
          duration: 4_000,
          action: undefined, // Tomorrow is already visible at the bottom of Today.
        }),
      ]);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    queryClient.clear();
  });

  it('puts the task into the list picked with the folder button', async () => {
    const created = makeTask({ id: 't1', title: 'Отчёт', list_id: 'work' });
    const request = vi.spyOn(api, 'createTask').mockResolvedValue(created);
    vi.spyOn(api, 'listTasks').mockResolvedValue([created]);
    const { queryClient } = renderWithClient(
      <QuickAdd />,
      [],
      [makeList({ id: 'work', name: 'Работа' }), makeList({ id: 'optimistic-9', name: 'Ещё нет' })],
    );
    const picker = screen.getByRole('combobox', { name: TEXTS.quickAddList });
    expect(screen.getByRole('option', { name: 'Ещё нет' })).toBeDisabled();

    await userEvent.selectOptions(picker, 'work');
    await userEvent.type(screen.getByRole('textbox'), 'Отчёт{Enter}');

    await waitFor(() => {
      expect(request).toHaveBeenCalledOnce();
    });
    expect(request.mock.calls[0]?.[0]).toMatchObject({ title: 'Отчёт', list_id: 'work' });
    queryClient.clear();
  });

  it('highlights @lists, uses their id and lets the folder override the token', async () => {
    const lists = [
      makeList({ id: 'work', name: 'Работа' }),
      makeList({ id: 'home', name: 'Личные дела' }),
      makeList({ id: 'optimistic-1', name: 'Будущее' }),
    ];
    const request = vi
      .spyOn(api, 'createTask')
      .mockImplementation((task) =>
        Promise.resolve(makeTask({ ...task, id: 'new', position: task.position ?? 1 })),
      );
    vi.spyOn(api, 'listTasks').mockResolvedValue([]);
    const { queryClient, container } = renderWithClient(<QuickAdd />, [], lists);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Отчёт @РАБОТА @неизвестно @будущее');
    expect(container.querySelectorAll('[data-token-kind="list"]')).toHaveLength(1);
    expect(container.querySelector('[data-token-kind="list"]')).toHaveTextContent('@РАБОТА');
    expect(screen.getByText(TEXTS.quickAddHint)).toHaveTextContent('@списки');
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(1);
    });
    expect(request.mock.calls[0]?.[0]).toMatchObject({
      title: 'Отчёт @неизвестно @будущее',
      list_id: 'work',
    });
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: TEXTS.quickAddList }),
      'home',
    );
    await userEvent.type(input, 'Звонок @работа{Enter}');
    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(2);
    });
    expect(request.mock.calls[1]?.[0]).toMatchObject({ title: 'Звонок', list_id: 'home' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: TEXTS.quickAddList }), '');
    await userEvent.type(input, 'Заметка @работа{Enter}');
    await waitFor(() => {
      expect(request).toHaveBeenCalledTimes(3);
    });
    expect(request.mock.calls[2]?.[0]).toMatchObject({ title: 'Заметка', list_id: null });
    queryClient.clear();
  });

  it('uses the current view at submit, preserving a draft across navigation', async () => {
    const created = makeTask({ id: 't1', title: 'Задача', tags: ['дом'] });
    const request = vi.spyOn(api, 'createTask').mockResolvedValue(created);
    vi.spyOn(api, 'listTasks').mockResolvedValue([created]);
    const { queryClient } = renderWithClient(<QuickAdd />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Задача');
    act(() => {
      navigateTo({ view: { kind: 'tag', tag: 'дом' } });
    });
    expect(input).toHaveValue('Задача');
    await userEvent.click(screen.getByRole('button', { name: TEXTS.quickAddSubmit }));
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({ due_date: null, tags: ['дом'] }),
    );
    expect(input).toHaveFocus();
    queryClient.clear();
  });

  it('adds an undated task to today optimistically and clears the field at once', async () => {
    const response = deferred<TaskRead>();
    const created = makeTask({ id: 't1', title: 'Задача', due_date: '2026-11-08' });
    const other = makeTask({ id: 'o', title: 'Другая', due_date: '2026-11-08', position: 0 });
    const request = vi.spyOn(api, 'createTask').mockReturnValue(response.promise);
    vi.spyOn(api, 'listTasks').mockResolvedValue([other, created]);
    const { queryClient } = renderWithClient(<App />, [other]);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Задача');
    fireEvent.submit(screen.getByRole('form', { name: TEXTS.quickAdd }));
    fireEvent.submit(screen.getByRole('form', { name: TEXTS.quickAdd })); // empty now: ignored

    // Shown at once, as an unsaved row (not a link until the server answers).
    expect(await screen.findByText('Задача')).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ due_date: '2026-11-08' }));
    // The server has not answered, yet the field is free for the next task...
    expect(input).toHaveValue('');
    expect(input).not.toHaveAttribute('readonly');
    await userEvent.type(input, 'Следующая');
    expect(input).toHaveValue('Следующая');
    // ...and other tasks stay usable.
    expect(screen.getByRole('checkbox', { name: /Другая/ })).not.toHaveAttribute('aria-disabled');

    act(() => {
      response.resolve(created);
    });
    expect(
      await screen.findByText(TEXTS.quickAddAdded(LIST_TITLES.today, null)),
    ).toBeInTheDocument();
    expect(queryClient.getQueryData<TaskRead[]>(taskKeys.list())?.map((task) => task.id)).toEqual([
      'o',
      't1',
    ]);
    queryClient.clear();
  });

  it('shows a destination action for a hidden task; clears search and opens the saved task', async () => {
    window.history.replaceState(null, '', '/?list=inbox&q=другое');
    const created = makeTask({ id: 'saved', title: 'Квартира', due_date: '2026-11-13' });
    vi.spyOn(api, 'createTask').mockResolvedValue(created);
    vi.spyOn(api, 'listTasks').mockResolvedValue([created]);
    const { queryClient } = renderWithClient(<QuickAdd />);
    await userEvent.type(screen.getByRole('textbox'), 'Квартира в пятницу{Enter}');
    await waitFor(() => {
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
    const toast = useToastStore.getState().toasts[0];
    expect(toast).toMatchObject({
      message: 'Добавлено в «Предстоящие», пт, 13 нояб.',
      duration: 4_000,
      action: { label: TEXTS.quickAddShow },
    });
    expect(toast?.action?.undo).toBeUndefined();
    act(() => toast?.action?.run());
    expect(parseLocation(window.location.search)).toEqual({
      view: { kind: 'list', list: 'upcoming' },
      query: '',
      taskId: 'saved',
      day: null,
    });
    queryClient.clear();
  });

  it('opens Today itself for an overdue task added outside Today', async () => {
    window.history.replaceState(null, '', '/?day=2026-11-07');
    const response = deferred<TaskRead>();
    const created = makeTask({ id: 'saved', title: 'Задача', due_date: '2026-11-07' });
    vi.spyOn(api, 'createTask').mockReturnValue(response.promise);
    vi.spyOn(api, 'listTasks').mockResolvedValue([created]);
    const { queryClient } = renderWithClient(<QuickAdd />);
    await userEvent.type(screen.getByRole('textbox'), 'Задача{Enter}');
    act(() => {
      navigateTo({ view: { kind: 'list', list: 'inbox' }, day: null });
    });
    act(() => {
      response.resolve(created);
    });
    await waitFor(() => {
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
    act(() => useToastStore.getState().toasts[0]?.action?.run());
    expect(parseLocation(window.location.search)).toMatchObject({
      view: { kind: 'list', list: 'today' },
      taskId: 'saved',
      day: null, // overdue tasks are listed on Today; no past day to open
    });
    queryClient.clear();
  });

  it('names the open user list and omits the action for its visible task', async () => {
    window.history.replaceState(null, '', '/?listId=work');
    const created = makeTask({ id: 'saved', title: 'Отчёт', list_id: 'work' });
    vi.spyOn(api, 'createTask').mockResolvedValue(created);
    vi.spyOn(api, 'listTasks').mockResolvedValue([created]);
    const { queryClient } = renderWithClient(
      <QuickAdd />,
      [],
      [makeList({ id: 'work', name: 'Работа' })],
    );
    await userEvent.type(screen.getByRole('textbox'), 'Отчёт{Enter}');
    await waitFor(() => {
      expect(useToastStore.getState().toasts).toEqual([
        expect.objectContaining({ message: 'Добавлено в «Работа»', action: undefined }),
      ]);
    });
    queryClient.clear();
  });

  it('confirms every successful create even when both visible tasks have the same destination', async () => {
    const first = makeTask({ id: 'first', title: 'Первая', due_date: '2026-11-08' });
    const second = makeTask({ id: 'second', title: 'Вторая', due_date: '2026-11-08' });
    vi.spyOn(api, 'createTask').mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    vi.spyOn(api, 'listTasks').mockResolvedValue([first, second]);
    const { queryClient } = renderWithClient(<QuickAdd />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Первая{Enter}');
    await waitFor(() => {
      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
    await userEvent.type(input, 'Вторая{Enter}');
    await waitFor(() => {
      expect(useToastStore.getState().toasts).toHaveLength(2);
    });
    expect(
      useToastStore.getState().toasts.map((toast) => [toast.message, toast.action, toast.duration]),
    ).toEqual([
      ['Добавлено в «Сегодня»', undefined, 4_000],
      ['Добавлено в «Сегодня»', undefined, 4_000],
    ]);
    queryClient.clear();
  });

  it('uses the screen open when the response arrives, after navigating away during saving', async () => {
    const response = deferred<TaskRead>();
    const created = makeTask({ id: 'saved', title: 'Задача', due_date: '2026-11-08' });
    vi.spyOn(api, 'createTask').mockReturnValue(response.promise);
    vi.spyOn(api, 'listTasks').mockResolvedValue([created]);
    const { queryClient } = renderWithClient(<QuickAdd />);
    await userEvent.type(screen.getByRole('textbox'), 'Задача{Enter}');
    expect(useToastStore.getState().toasts).toEqual([]); // Only saved tasks get success feedback.
    act(() => {
      navigateTo({ view: { kind: 'list', list: 'upcoming' } });
    });
    act(() => {
      response.resolve(created);
    });
    await waitFor(() => {
      expect(useToastStore.getState().toasts[0]?.action?.label).toBe(TEXTS.quickAddShow);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    queryClient.clear();
  });

  it('rolls back a failed create, brings the text back and allows retry', async () => {
    const response = deferred<TaskRead>();
    const created = makeTask({ id: 't1', title: 'Задача', due_date: '2026-11-08', tags: ['дом'] });
    const request = vi
      .spyOn(api, 'createTask')
      .mockReturnValueOnce(response.promise)
      .mockResolvedValue(created);
    const listRequest = vi.spyOn(api, 'listTasks').mockResolvedValue([]);
    const { queryClient } = renderWithClient(<QuickAdd />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Задача #дом{Enter}');
    expect(input).toHaveValue('');
    expect(queryClient.getQueryData<TaskRead[]>(taskKeys.list())).toHaveLength(1);

    act(() => {
      response.reject(new Error('offline'));
    });

    // The text comes back; the toast (see Toaster tests) says what failed.
    await waitFor(() => {
      expect(input).toHaveValue('Задача #дом');
    });
    expect(queryClient.getQueryData(taskKeys.list())).toEqual([]);
    listRequest.mockResolvedValue([created]);
    await userEvent.click(input);
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(queryClient.getQueryData<TaskRead[]>(taskKeys.list())).toEqual([created]);
    });
    expect(input).toHaveValue('');
    expect(request).toHaveBeenCalledTimes(2);
    queryClient.clear();
  });

  it('keeps new typing when an earlier create fails', async () => {
    const response = deferred<TaskRead>();
    vi.spyOn(api, 'createTask').mockReturnValue(response.promise);
    vi.spyOn(api, 'listTasks').mockResolvedValue([]);
    const { queryClient } = renderWithClient(<QuickAdd />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Первая{Enter}');
    await userEvent.type(input, 'Вторая в работе');

    act(() => {
      response.reject(new Error('offline'));
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<TaskRead[]>(taskKeys.list())).toEqual([]);
    });
    expect(input).toHaveValue('Вторая в работе');
    queryClient.clear();
  });

  it('brings back an earlier failed create even after a later one was sent', async () => {
    const first = deferred<TaskRead>();
    const second = makeTask({ id: 't2', title: 'Вторая' });
    vi.spyOn(api, 'createTask').mockReturnValueOnce(first.promise).mockResolvedValueOnce(second);
    vi.spyOn(api, 'listTasks').mockResolvedValue([second]);
    const { queryClient } = renderWithClient(<QuickAdd />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Первая{Enter}');
    await userEvent.type(input, 'Вторая{Enter}');

    act(() => {
      first.reject(new Error('offline'));
    });

    await waitFor(() => {
      expect(input).toHaveValue('Первая');
    });
    queryClient.clear();
  });

  it('does not submit empty or token-only input, or a title longer than 500 characters', async () => {
    const request = vi.spyOn(api, 'createTask');
    renderWithClient(<QuickAdd />);
    const input = screen.getByRole('textbox');
    expect(screen.getByRole('button')).toBeDisabled();
    await userEvent.type(input, 'завтра #дом !!{Enter}');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(QUICK_ADD_ISSUES['title-required'])).toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'а'.repeat(501) } });
    fireEvent.submit(screen.getByRole('form'));
    expect(screen.getByText(QUICK_ADD_ISSUES['title-too-long'])).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('waits for the initial task list before allowing creation', async () => {
    const response = deferred<TaskRead[]>();
    vi.spyOn(api, 'listTasks').mockReturnValue(response.promise);
    const request = vi.spyOn(api, 'createTask');
    const queryClient = createQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <QuickAdd />
      </QueryClientProvider>,
    );
    await userEvent.type(screen.getByRole('textbox'), 'Задача{Enter}');
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByRole('button')).toBeDisabled();
    act(() => {
      response.resolve([]);
    });
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeEnabled();
    });
    queryClient.clear();
  });

  it('does not submit Enter during IME composition, but submits after composition ends', async () => {
    const created = makeTask({ id: 't1', title: 'Задача', due_date: '2026-11-08' });
    const request = vi.spyOn(api, 'createTask').mockResolvedValue(created);
    vi.spyOn(api, 'listTasks').mockResolvedValue([created]);
    const { queryClient } = renderWithClient(<QuickAdd />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Задача');
    fireEvent.compositionStart(input);
    expect(fireEvent.keyDown(input, { key: 'Enter', isComposing: true })).toBe(false);
    fireEvent.submit(screen.getByRole('form'));
    expect(request).not.toHaveBeenCalled();
    fireEvent.compositionEnd(input);
    expect(fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })).toBe(false);
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
    expect(request).toHaveBeenCalledTimes(1);
    queryClient.clear();
  });

  it('recalculates the contextual date at submit time after midnight', async () => {
    const created = makeTask({ id: 't1', title: 'Задача', due_date: '2026-11-09' });
    const request = vi.spyOn(api, 'createTask').mockResolvedValue(created);
    vi.spyOn(api, 'listTasks').mockResolvedValue([created]);
    const { queryClient } = renderWithClient(<QuickAdd />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Задача');
    vi.setSystemTime(new Date(2026, 10, 9, 0, 0));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ due_date: '2026-11-09' }));
    queryClient.clear();
  });

  it('synchronizes the highlight scroll position with the native input', () => {
    const { container } = renderWithClient(<QuickAdd />);
    const input = screen.getByRole('textbox');
    input.scrollLeft = 120;
    fireEvent.scroll(input);
    expect(container.querySelector('.quick-add-mirror')?.scrollLeft).toBe(120);
    input.scrollLeft = 60;
    fireEvent(window, new Event('resize'));
    expect(container.querySelector('.quick-add-mirror')?.scrollLeft).toBe(60);
  });
});
