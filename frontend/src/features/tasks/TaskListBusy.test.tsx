// @vitest-environment jsdom
import { MutationObserver } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../api';
import type { TaskRead } from '../../api/schema';
import { makeTask } from '../../test/makeTask';
import { renderWithClient } from '../../test/renderWithClient';

import { TaskListContainer } from './TaskListContainer';
import { mutationTaskId, updateTaskMutation } from './taskMutations';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const A = makeTask({ id: 'a', title: 'Первая', position: 1 });
const B = makeTask({ id: 'b', title: 'Вторая', position: 2 });

describe('task locking during writes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('locks only the task being written; others stay usable', async () => {
    window.history.replaceState(null, '', '/?list=inbox');
    const slow = deferred<TaskRead>();
    const update = vi
      .spyOn(api, 'updateTask')
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValue({ ...B, completed_at: '2026-11-08T12:00:00Z' });
    vi.spyOn(api, 'listTasks').mockResolvedValue([A, B]);
    const { queryClient } = renderWithClient(<TaskListContainer />, [A, B]);

    await userEvent.click(screen.getByRole('checkbox', { name: /Первая/ }));
    expect(update).toHaveBeenCalledTimes(1); // A's request is still running

    const second = screen.getByRole('checkbox', { name: /Вторая/ });
    expect(second).not.toHaveAttribute('aria-disabled');
    await userEvent.click(second);
    expect(update).toHaveBeenCalledTimes(2);

    act(() => {
      slow.resolve({ ...A, completed_at: '2026-11-08T12:00:00Z' });
    });
    await waitFor(() => {
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
    queryClient.clear();
  });

  it('marks a task busy while its own write runs', async () => {
    window.history.replaceState(null, '', '/?list=inbox');
    const slow = deferred<TaskRead>();
    vi.spyOn(api, 'updateTask').mockReturnValue(slow.promise);
    // The refetch after the write returns the server's state, with the new title.
    vi.spyOn(api, 'listTasks').mockResolvedValue([A, { ...B, title: 'Вторая!' }]);
    const { queryClient } = renderWithClient(<TaskListContainer />, [A, B]);

    // A rename keeps B in the inbox while its request is in flight.
    const rename = new MutationObserver(queryClient, updateTaskMutation({ api, queryClient }));
    // Not inside act(): an async act would hold UI updates until the request ends.
    const done = rename.mutate({ id: 'b', patch: { title: 'Вторая!' } });

    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /Вторая!/ })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });
    expect(screen.getByRole('checkbox', { name: /Первая/ })).not.toHaveAttribute('aria-disabled');

    act(() => {
      slow.resolve({ ...B, title: 'Вторая!' });
    });
    await act(() => done);
    await waitFor(() => {
      expect(screen.getByRole('checkbox', { name: /Вторая!/ })).not.toHaveAttribute(
        'aria-disabled',
      );
    });
    queryClient.clear();
  });
});

describe('mutationTaskId', () => {
  it.each([
    ['task-id', 'task-id'],
    [{ id: 'x', patch: {} }, 'x'],
    [{ id: 'x', tasks: [] }, 'x'],
    [{ title: 'new task' }, null],
    [{ id: 42 }, null],
    [null, null],
    [undefined, null],
  ])('%j -> %j', (variables, expected) => {
    expect(mutationTaskId(variables)).toBe(expected);
  });
});
