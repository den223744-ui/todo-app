import type { QueryClient } from '@tanstack/react-query';

const pending = new WeakMap<QueryClient, number>();

export function beginListMutation(client: QueryClient): void {
  pending.set(client, (pending.get(client) ?? 0) + 1);
}

export function endListMutation(client: QueryClient): boolean {
  const left = Math.max(0, (pending.get(client) ?? 0) - 1);
  pending.set(client, left);
  return left === 0;
}

export function hasPendingListMutations(client: QueryClient): boolean {
  return (pending.get(client) ?? 0) > 0;
}
