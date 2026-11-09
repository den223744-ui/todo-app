// @vitest-environment jsdom
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api } from '../../api';
import { createQueryClient } from '../../api/queryClient';
import type { TaskRead } from '../../api/schema';
import { toLocalDateString } from '../../domain/dates';
import { makeTask } from '../../test/makeTask';
import { useToastStore } from '../../store/toastStore';
import { mutationErrorToast } from '../toasts/mutationToast';
import { Toaster } from '../toasts/Toaster';
import { UndoShortcut } from '../toasts/UndoShortcut';
import { taskKeys } from '../tasks/taskQueries';
import { listKeys } from '../lists/listQueries';
import { TimelineContainer } from './TimelineContainer';

const now = new Date(2026, 10, 9, 12);
function setup(time = '14:00:00') {
  const task = makeTask({
    id: 't',
    title: 'Звонок',
    due_date: toLocalDateString(now),
    due_time: time,
    duration_minutes: 30,
  });
  let saved = task;
  vi.spyOn(api, 'listTasks').mockImplementation(() => Promise.resolve([saved]));
  const update = vi.spyOn(api, 'updateTask').mockImplementation((_id, patch) => {
    saved = { ...saved, due_time: patch.due_time as string };
    return Promise.resolve(saved);
  });
  const client = createQueryClient({
    onMutationError: (error, mutation) => {
      const message = mutationErrorToast(mutation.meta, mutation.state.variables, error);
      if (message) useToastStore.getState().showToast(message);
    },
  });
  client.setQueryData(taskKeys.list(), [task]);
  client.setQueryData(listKeys.list(), []);
  render(
    <QueryClientProvider client={client}>
      <TimelineContainer />
      <Toaster />
      <UndoShortcut />
    </QueryClientProvider>,
  );
  return { client, update, block: screen.getByRole('button', { name: /Звонок/ }) };
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  useToastStore.setState({ toasts: [] });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it('coalesces rapid arrows into one toast and Undo restores the time before the whole series', async () => {
  const { client, update, block } = setup();
  block.focus();
  fireEvent.keyDown(block, { key: 'ArrowDown' });
  fireEvent.keyDown(block, { key: 'ArrowDown' });
  fireEvent.keyDown(block, { key: 'ArrowDown', shiftKey: true });
  await waitFor(() => {
    expect(update).toHaveBeenLastCalledWith('t', { due_time: '15:30:00' });
  });
  expect(useToastStore.getState().toasts).toHaveLength(1);
  expect(screen.getByText('Перенесено на 15:30')).toBeInTheDocument();
  expect(block).toHaveFocus();
  expect(block).toHaveAttribute('aria-describedby');
  await userEvent.keyboard('{Control>}z{/Control}');
  await waitFor(() => {
    expect(update).toHaveBeenLastCalledWith('t', { due_time: '14:00:00' });
  });
  await waitFor(() => {
    expect(client.getQueryData<TaskRead[]>(taskKeys.list())?.[0]?.due_time).toBe('14:00:00');
  });
  client.clear();
});

it('starts a new keyboard series after a pause and undo returns to its start', async () => {
  const { client, update, block } = setup();
  fireEvent.keyDown(block, { key: 'ArrowDown' });
  await waitFor(() => {
    expect(update).toHaveBeenLastCalledWith('t', { due_time: '14:15:00' });
  });
  vi.setSystemTime(new Date(now.getTime() + 1000));
  fireEvent.keyDown(block, { key: 'ArrowDown' });
  await waitFor(() => {
    expect(update).toHaveBeenLastCalledWith('t', { due_time: '14:30:00' });
  });
  act(() => {
    useToastStore.getState().undoLatest();
  });
  await waitFor(() => {
    expect(update).toHaveBeenLastCalledWith('t', { due_time: '14:15:00' });
  });
  client.clear();
});

it('clamps to midnight/end of day, ignores modifiers, and rolls back rejected writes with an error toast', async () => {
  const { client, update, block } = setup('00:00:00');
  fireEvent.keyDown(block, { key: 'ArrowUp' });
  fireEvent.keyDown(block, { key: 'ArrowDown', ctrlKey: true });
  expect(update).not.toHaveBeenCalled();
  update.mockRejectedValueOnce(new Error('refused'));
  fireEvent.keyDown(block, { key: 'ArrowDown' });
  await waitFor(() => {
    expect(update).toHaveBeenCalled();
  });
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: 'Отменить' })).toBeNull();
  });
  expect(client.getQueryData<TaskRead[]>(taskKeys.list())?.[0]?.due_time).toBe('00:00:00');
  expect(screen.getByText(/Не удалось сохранить/)).toBeInTheDocument();
  client.clear();
});

it('clamps the end to 24:00 and keeps duration unchanged', async () => {
  const { client, update, block } = setup('23:15:00');
  fireEvent.keyDown(block, { key: 'ArrowDown', shiftKey: true });
  await waitFor(() => {
    expect(update).toHaveBeenCalledWith('t', { due_time: '23:30:00' });
  });
  expect(client.getQueryData<TaskRead[]>(taskKeys.list())?.[0]?.duration_minutes).toBe(30);
  client.clear();
});
