// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../api';
import { createQueryClient } from '../../api/queryClient';
import type { TaskRead } from '../../api/schema';
import { App } from '../../App';
import { QUICK_ADD_ISSUES, TEXTS } from '../../constants/texts';
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
    expect(screen.getByRole('status')).toHaveTextContent(TEXTS.quickAddSuccess);
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

  it('adds an undated task to today optimistically and prevents duplicate submissions', async () => {
    const response = deferred<TaskRead>();
    const created = makeTask({ id: 't1', title: 'Задача', due_date: '2026-11-08' });
    const request = vi.spyOn(api, 'createTask').mockReturnValue(response.promise);
    vi.spyOn(api, 'listTasks').mockResolvedValue([created]);
    const { queryClient } = renderWithClient(<App />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Задача');
    fireEvent.submit(screen.getByRole('form', { name: TEXTS.quickAdd }));
    fireEvent.submit(screen.getByRole('form', { name: TEXTS.quickAdd }));
    expect(await screen.findByRole('link', { name: /Задача/ })).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(expect.objectContaining({ due_date: '2026-11-08' }));
    expect(input).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: TEXTS.quickAddSaving })).toBeDisabled();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    act(() => {
      response.resolve(created);
    });
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
    expect(queryClient.getQueryData<TaskRead[]>(taskKeys.list())?.map((task) => task.id)).toEqual([
      't1',
    ]);
    queryClient.clear();
  });

  it('rolls back a failed create, keeps the full draft and allows retry', async () => {
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
    await waitFor(() => {
      expect(queryClient.getQueryData<TaskRead[]>(taskKeys.list())).toHaveLength(1);
    });
    act(() => {
      response.reject(new Error('offline'));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(TEXTS.quickAddError);
    expect(input).toHaveValue('Задача #дом');
    expect(queryClient.getQueryData(taskKeys.list())).toEqual([]);
    listRequest.mockResolvedValue([created]);
    await userEvent.keyboard('{Enter}');
    await waitFor(() => {
      expect(input).toHaveValue('');
    });
    expect(request).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    queryClient.clear();
  });

  it('clears a network error when the draft is edited', async () => {
    vi.spyOn(api, 'createTask').mockRejectedValue(new Error('offline'));
    vi.spyOn(api, 'listTasks').mockResolvedValue([]);
    const { queryClient } = renderWithClient(<QuickAdd />);
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Задача{Enter}');
    await screen.findByRole('alert');
    await userEvent.type(input, ' 2');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
