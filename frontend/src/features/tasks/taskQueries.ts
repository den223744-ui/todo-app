import { queryOptions, type QueryClient } from '@tanstack/react-query';

import type { ApiClient } from '../../api/client';
import { hasPendingTaskMutations } from './pendingMutations';

export const taskKeys = {
  all: ['tasks'] as const,
  list: () => [...taskKeys.all, 'list'] as const,
  /** Shared by every task mutation. */
  mutation: () => [...taskKeys.all, 'mutation'] as const,
};

/**
 * All live tasks of the workspace, flat (subtasks carry parent_id).
 *
 * Background refetches (window focus, reconnect, mount) are skipped while a
 * task mutation is pending: the server would answer with the state before the
 * change and wipe the optimistic update. The last mutation to settle refetches.
 */
export function tasksQueryOptions(api: ApiClient, queryClient: QueryClient) {
  const idle = () => !hasPendingTaskMutations(queryClient);
  return queryOptions({
    queryKey: taskKeys.list(),
    queryFn: ({ signal }) => api.listTasks({ signal }),
    refetchOnWindowFocus: idle,
    refetchOnReconnect: idle,
    refetchOnMount: idle,
  });
}
