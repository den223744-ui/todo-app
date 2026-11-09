import { queryOptions, type QueryClient } from '@tanstack/react-query';

import type { ApiClient } from '../../api/client';
import { hasPendingListMutations } from './pendingListMutations';

export const listKeys = {
  all: ['lists'] as const,
  list: () => [...listKeys.all, 'list'] as const,
  mutation: () => [...listKeys.all, 'mutation'] as const,
};

/** The workspace's lists (Работа, Дом, ...). */
export function listsQueryOptions(api: ApiClient, queryClient: QueryClient) {
  const idle = () => !hasPendingListMutations(queryClient);
  return queryOptions({
    queryKey: listKeys.list(),
    queryFn: ({ signal }) => api.listLists({ signal }),
    refetchOnWindowFocus: idle,
    refetchOnReconnect: idle,
    refetchOnMount: idle,
  });
}
