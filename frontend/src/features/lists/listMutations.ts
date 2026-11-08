/**
 * Creating a list, optimistically: the list shows in the sidebar at once and
 * is swapped for the server's version (or removed when the server refuses).
 */
import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import type { ApiClient } from '../../api/client';
import type { TaskListCreate, TaskListRead } from '../../api/schema';
import { OPTIMISTIC_ID_PREFIX } from '../tasks/taskMutations';
import { listKeys } from './listQueries';

export interface ListMutationDeps {
  api: ApiClient;
  queryClient: QueryClient;
  now?: () => Date;
  newId?: () => string;
}

/** Colours in the server's order: the optimistic list guesses the next one. */
export const LIST_COLORS = ['blue', 'brown', 'gray', 'green', 'red', 'olive'] as const;

export function createListMutation(
  deps: ListMutationDeps,
): MutationOptions<TaskListRead, Error, TaskListCreate, { optimisticId: string }> {
  const { api, queryClient } = deps;
  const now = deps.now ?? (() => new Date());
  const newId = deps.newId ?? (() => `${OPTIMISTIC_ID_PREFIX}${crypto.randomUUID()}`);
  const key = listKeys.list();
  const write = (update: (lists: TaskListRead[]) => TaskListRead[]) => {
    queryClient.setQueryData<TaskListRead[]>(key, (lists) => update(lists ?? []));
  };
  return {
    mutationKey: listKeys.mutation(),
    meta: { kind: 'createList' },
    mutationFn: (input) => api.createList(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key });
      const lists = queryClient.getQueryData<TaskListRead[]>(key) ?? [];
      const optimisticId = newId();
      const timestamp = now().toISOString();
      const last = Math.max(0, ...lists.map((list) => list.position));
      write((current) => [
        ...current,
        {
          id: optimisticId,
          name: input.name.trim(),
          color: input.color ?? LIST_COLORS[lists.length % LIST_COLORS.length] ?? 'blue',
          position: input.position ?? last + 1,
          created_at: timestamp,
          updated_at: timestamp,
        },
      ]);
      return { optimisticId };
    },
    onSuccess: (created, _input, context) => {
      write((lists) => lists.map((list) => (list.id === context.optimisticId ? created : list)));
    },
    onError: (_error, _input, context) => {
      if (context) write((lists) => lists.filter((list) => list.id !== context.optimisticId));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  };
}
