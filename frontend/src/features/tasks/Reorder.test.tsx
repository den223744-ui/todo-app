// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi, type MockInstance } from 'vitest';
import type { ReactNode } from 'react';
import { api } from '../../api';
import { createQueryClient } from '../../api/queryClient';
import type { TaskRead } from '../../api/schema';
import { makeTask } from '../../test/makeTask';
import { useUiStore } from '../../store/uiStore';
import { useToastStore } from '../../store/toastStore';
import { mutationErrorToast } from '../toasts/mutationToast';
import { taskKeys } from './taskQueries';
import { useReorderTasks } from './useReorderTasks';

function setup(tasks: TaskRead[]) {
  useUiStore.setState({ reorderBusy: false });
  useToastStore.setState({ toasts: [] });
  const client = createQueryClient({
    onMutationError: (error, mutation) => {
      const message = mutationErrorToast(mutation.meta, mutation.state.variables, error);
      if (message) useToastStore.getState().showToast(message);
    },
  });
  client.setQueryData(taskKeys.list(), tasks);
  let saved = tasks;
  const update: MockInstance<typeof api.updateTask> = vi
    .spyOn(api, 'updateTask')
    .mockImplementation((id, patch) => {
      saved = saved.map((task) =>
        task.id === id ? { ...task, position: patch.position as number } : task,
      );
      return Promise.resolve(saved.find((task) => task.id === id) as TaskRead);
    });
  const hook = renderHook(useReorderTasks, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return { ...hook, client, update, saved: () => saved };
}
afterEach(() => {
  vi.restoreAllMocks();
});

it('applies one optimistic position, holds concurrent moves and does not add Undo', async () => {
  const tasks = [makeTask({ id: 'a', position: 1 }), makeTask({ id: 'b', position: 2 })];
  const { result, client, update } = setup(tasks);
  let resolve!: (task: TaskRead) => void;
  update.mockImplementationOnce(
    () =>
      new Promise((yes) => {
        resolve = yes;
      }),
  );
  let operation: Promise<void>;
  act(() => {
    operation = result.current(tasks, 'b', 0);
  });
  await waitFor(() => {
    expect(
      client.getQueryData<TaskRead[]>(taskKeys.list())?.find((task) => task.id === 'b')?.position,
    ).toBe(0);
  });
  await act(async () => {
    await result.current(tasks, 'a', 1);
  });
  expect(update).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve({ ...(tasks[1] as TaskRead), position: 0 });
    await operation;
  });
  expect(useToastStore.getState().toasts).toHaveLength(0);
  expect(useToastStore.getState().undoLatest()).toBe(false);
  await act(async () => {
    await result.current(tasks, 'a', 0);
  });
  expect(update).toHaveBeenCalledTimes(1);
  client.clear();
});

it('rolls back every position after a partial rebalance failure, including server compensation', async () => {
  const visible = [
    makeTask({ id: 'a', position: 1 }),
    makeTask({ id: 'b', position: 1 + Number.EPSILON }),
    makeTask({ id: 'c', position: 3 }),
  ];
  const tasks = [...visible, makeTask({ id: 'hidden', position: 0 })];
  const { result, client, update, saved } = setup(tasks);
  update.mockRejectedValueOnce(new Error('refused'));
  await act(async () => {
    await result.current(visible, 'c', 1);
  });
  for (const task of tasks) {
    expect(
      client.getQueryData<TaskRead[]>(taskKeys.list())?.find((item) => item.id === task.id)
        ?.position,
    ).toBe(task.position);
    expect(saved().find((item) => item.id === task.id)?.position).toBe(task.position);
  }
  expect(update).toHaveBeenCalledTimes(8);
  expect(useToastStore.getState().toasts).toHaveLength(1);
  expect(useToastStore.getState().toasts[0]?.message).toContain('Не удалось сохранить');
  expect(useToastStore.getState().undoLatest()).toBe(false);
  client.clear();
});
