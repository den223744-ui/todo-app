import { queryOptions } from '@tanstack/react-query';

import type { ApiClient } from '../../api/client';

export const listKeys = {
  all: ['lists'] as const,
  list: () => [...listKeys.all, 'list'] as const,
  mutation: () => [...listKeys.all, 'mutation'] as const,
};

/** The workspace's lists (Работа, Дом, ...). */
export function listsQueryOptions(api: ApiClient) {
  return queryOptions({
    queryKey: listKeys.list(),
    queryFn: ({ signal }) => api.listLists({ signal }),
  });
}
