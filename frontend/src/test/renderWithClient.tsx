/** Test helper: render with a QueryClient whose task list is already cached. */
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

import { createQueryClient } from '../api/queryClient';
import type { TaskRead } from '../api/schema';
import { taskKeys } from '../features/tasks/taskQueries';

export function renderWithClient(ui: ReactElement, tasks: TaskRead[] = []) {
  const queryClient = createQueryClient();
  // Fresh data (within staleTime): no request goes out on mount.
  queryClient.setQueryData(taskKeys.list(), tasks);
  const result = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { ...result, queryClient };
}
