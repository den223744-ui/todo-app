import { useQueryClient } from '@tanstack/react-query';

import type { TaskRead } from '../../api/schema';
import { reorderPatches, topLevelOrder } from '../../domain/reorder';
import { useUiStore } from '../../store/uiStore';

import { beginTaskMutation, endTaskMutation, pendingTaskWrites } from './pendingMutations';
import { taskKeys } from './taskQueries';
import { useUpdateTask } from './useTasks';

/** Hold refetches until every PATCH (and, on failure, compensation) settles. */
export function useReorderTasks() {
  const client = useQueryClient();
  const update = useUpdateTask();
  return async (siblings: readonly TaskRead[], id: string, index: number) => {
    if (useUiStore.getState().reorderBusy || pendingTaskWrites(client, id) > 0) return;
    const current = client.getQueryData<TaskRead[]>(taskKeys.list()) ?? [];
    const patches = reorderPatches(siblings, id, index, topLevelOrder(current));
    if (!patches.length) return;
    const before = current.filter((task) => patches.some((patch) => patch.id === task.id));
    useUiStore.setState({ reorderBusy: true });
    beginTaskMutation(client);
    try {
      const results = await Promise.allSettled(
        patches.map(({ id, position }) => update.mutateAsync({ id, patch: { position } })),
      );
      if (results.some((result) => result.status === 'rejected')) {
        const positions = new Map(before.map((task) => [task.id, task.position]));
        client.setQueryData<TaskRead[]>(taskKeys.list(), (tasks = []) =>
          tasks.map((task) =>
            positions.has(task.id) ? { ...task, position: positions.get(task.id) as number } : task,
          ),
        );
        // No bulk endpoint: restore successful server writes with compensating PATCHes.
        await Promise.allSettled(
          before.map(({ id, position }) => update.mutateAsync({ id, patch: { position } })),
        );
      }
    } finally {
      useUiStore.setState({ reorderBusy: false });
      if (endTaskMutation(client)) await client.invalidateQueries({ queryKey: taskKeys.list() });
    }
  };
}
