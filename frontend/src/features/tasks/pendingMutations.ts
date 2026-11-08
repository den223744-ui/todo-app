/**
 * Count of task mutations in flight, per QueryClient.
 *
 * TanStack's isMutating() is not enough to find "the last mutation": a
 * mutation is marked settled only after its onSettled callback, so two
 * mutations finishing in the same tick both still see each other and neither
 * refetches. This counter is changed synchronously at the start of onMutate
 * and in onSettled, so exactly one mutation sees it reach zero.
 *
 * The same count keeps background refetches (window focus, reconnect, mount)
 * from replacing optimistic state with an older server answer.
 *
 * Writes to one task are also counted per task: the server's answer to an
 * earlier write must not replace the task while later writes to it are still
 * pending, or their optimistic changes would vanish from the cache (and the
 * next edit, built from the cache, would send the server a list without them).
 */
import type { QueryClient } from '@tanstack/react-query';

import type { TaskField } from '../../domain/taskCache';

const pending = new WeakMap<QueryClient, number>();
const pendingByTask = new WeakMap<QueryClient, Map<string, TaskWrite[]>>();

export function beginTaskMutation(queryClient: QueryClient): void {
  pending.set(queryClient, (pending.get(queryClient) ?? 0) + 1);
}

/** Returns true when this was the last task mutation in flight. */
export function endTaskMutation(queryClient: QueryClient): boolean {
  const left = Math.max(0, (pending.get(queryClient) ?? 0) - 1);
  pending.set(queryClient, left);
  return left === 0;
}

export function hasPendingTaskMutations(queryClient: QueryClient): boolean {
  return (pending.get(queryClient) ?? 0) > 0;
}

interface TaskWrite {
  /** The mutation's variables: TanStack hands the same value to onMutate and onSettled. */
  key: unknown;
  /** Task fields this write sets (empty for delete and restore). */
  fields: ReadonlySet<TaskField>;
}

function writesOf(queryClient: QueryClient, taskId: string): TaskWrite[] {
  let byTask = pendingByTask.get(queryClient);
  if (!byTask) {
    byTask = new Map();
    pendingByTask.set(queryClient, byTask);
  }
  let writes = byTask.get(taskId);
  if (!writes) {
    writes = [];
    byTask.set(taskId, writes);
  }
  return writes;
}

/** Register a write to the task, in the order the writes were made. */
export function beginTaskWrite(
  queryClient: QueryClient,
  taskId: string,
  key: unknown,
  fields: ReadonlySet<TaskField> = new Set(),
): void {
  writesOf(queryClient, taskId).push({ key, fields });
}

export function endTaskWrite(queryClient: QueryClient, taskId: string, key: unknown): void {
  const writes = writesOf(queryClient, taskId);
  const index = writes.findIndex((entry) => Object.is(entry.key, key));
  if (index !== -1) writes.splice(index, 1);
  if (writes.length === 0) pendingByTask.get(queryClient)?.delete(taskId);
}

/** Writes to this task still in flight, the asking one included. */
export function pendingTaskWrites(queryClient: QueryClient, taskId: string): number {
  return pendingByTask.get(queryClient)?.get(taskId)?.length ?? 0;
}

/** Fields that writes made after this one (still in flight) set again. */
export function fieldsWrittenLater(
  queryClient: QueryClient,
  taskId: string,
  key: unknown,
): Set<TaskField> {
  const writes = pendingByTask.get(queryClient)?.get(taskId) ?? [];
  const index = writes.findIndex((entry) => Object.is(entry.key, key));
  return new Set(writes.slice(index + 1).flatMap((entry) => [...entry.fields]));
}
