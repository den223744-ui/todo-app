import { queryOptions } from '@tanstack/react-query';

import type { ApiClient } from '../../api/client';

export const taskKeys = {
  all: ['tasks'] as const,
  list: () => [...taskKeys.all, 'list'] as const,
  /** Shared by every task mutation, to know when the last one settles. */
  mutation: () => [...taskKeys.all, 'mutation'] as const,
};

/** All live tasks of the workspace, flat (subtasks carry parent_id). */
export function tasksQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: taskKeys.list(),
    queryFn: ({ signal }) => api.listTasks({ signal }),
  });
}
