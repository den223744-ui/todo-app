/** Test helper: render with a QueryClient whose tasks and lists are already cached. */
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

import { createQueryClient } from '../api/queryClient';
import type { TaskListRead, TaskRead } from '../api/schema';
import { listKeys } from '../features/lists/listQueries';
import { taskKeys } from '../features/tasks/taskQueries';

export function renderWithClient(
  ui: ReactElement,
  tasks: TaskRead[] = [],
  lists: TaskListRead[] = [],
) {
  const queryClient = createQueryClient();
  // Fresh data (within staleTime): no request goes out on mount.
  queryClient.setQueryData(taskKeys.list(), tasks);
  queryClient.setQueryData(listKeys.list(), lists);
  const result = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return { ...result, queryClient };
}
