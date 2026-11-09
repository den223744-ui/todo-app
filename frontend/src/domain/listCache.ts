import type { TaskListRead, TaskListUpdate, TaskRead } from '../api/schema';

/** Revert only the fields written by this operation; keep unrelated changes. */
export function revertListUpdate(
  current: TaskListRead,
  previous: TaskListRead,
  patch: TaskListUpdate,
): TaskListRead {
  return {
    ...current,
    ...(patch.name !== undefined ? { name: previous.name } : {}),
    ...(patch.color !== undefined ? { color: previous.color } : {}),
    ...(patch.position !== undefined ? { position: previous.position } : {}),
    updated_at: previous.updated_at,
  };
}

export function detachList(tasks: readonly TaskRead[], listId: string): TaskRead[] {
  return tasks.map((task) => (task.list_id === listId ? { ...task, list_id: null } : task));
}

/** Preserve tasks moved elsewhere or edited while deletion was pending. */
export function restoreTaskLists(
  tasks: readonly TaskRead[],
  affected: ReadonlySet<string>,
  listId: string,
): TaskRead[] {
  return tasks.map((task) =>
    affected.has(task.id) && task.list_id === null ? { ...task, list_id: listId } : task,
  );
}
