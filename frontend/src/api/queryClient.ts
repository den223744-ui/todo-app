import { MutationCache, QueryClient, type Mutation } from '@tanstack/react-query';

import { ApiError } from './client';

const MAX_QUERY_RETRIES = 2;

/** Client errors (4xx) will not change on retry; network and server errors may. */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const isClientError = error instanceof ApiError && error.status >= 400 && error.status < 500;
  return !isClientError && failureCount < MAX_QUERY_RETRIES;
}

export interface QueryClientOptions {
  /** Called for every failed mutation, after its own rollback (e.g. for a toast). */
  onMutationError?: (error: Error, mutation: Mutation<unknown, unknown>) => void;
}

export function createQueryClient(options: QueryClientOptions = {}): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        options.onMutationError?.(error, mutation);
      },
    }),
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
