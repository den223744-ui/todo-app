import type { QueryClient } from '@tanstack/react-query';

// UI identity only: replacing a temporary id must not replay a row's enter/exit.
const keys = new WeakMap<QueryClient, Map<string, string>>();
export function preserveTaskKey(client: QueryClient, id: string, optimisticId: string) {
  let aliases = keys.get(client);
  if (!aliases) {
    aliases = new Map();
    keys.set(client, aliases);
  }
  aliases.set(id, optimisticId);
}
export const taskPresentationKey = (client: QueryClient, id: string) =>
  keys.get(client)?.get(id) ?? id;
