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

const pending = new WeakMap<QueryClient, number>();
const pendingByTask = new WeakMap<QueryClient, Map<string, number>>();

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

function taskCounts(queryClient: QueryClient): Map<string, number> {
  let counts = pendingByTask.get(queryClient);
  if (!counts) {
    counts = new Map();
    pendingByTask.set(queryClient, counts);
  }
  return counts;
}

export function beginTaskWrite(queryClient: QueryClient, taskId: string): void {
  const counts = taskCounts(queryClient);
  counts.set(taskId, (counts.get(taskId) ?? 0) + 1);
}

export function endTaskWrite(queryClient: QueryClient, taskId: string): void {
  const counts = taskCounts(queryClient);
  const left = (counts.get(taskId) ?? 0) - 1;
  if (left > 0) counts.set(taskId, left);
  else counts.delete(taskId);
}

/** Writes to this task still in flight, the asking one included. */
export function pendingTaskWrites(queryClient: QueryClient, taskId: string): number {
  return pendingByTask.get(queryClient)?.get(taskId) ?? 0;
}
