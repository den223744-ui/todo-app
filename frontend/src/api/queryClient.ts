import { QueryClient } from '@tanstack/react-query';

import { ApiError } from './client';

const MAX_QUERY_RETRIES = 2;

/** Client errors (4xx) will not change on retry; network and server errors may. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const isClientError = error instanceof ApiError && error.status >= 400 && error.status < 500;
  return !isClientError && failureCount < MAX_QUERY_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        staleTime: 30_000,
      },
      mutations: {
        // Writes are not retried blindly; the user sees the error and the rollback.
        retry: false,
      },
    },
  });
}
