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
 */
import type { QueryClient } from '@tanstack/react-query';

const pending = new WeakMap<QueryClient, number>();

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
