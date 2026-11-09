/**
 * Creating a list, optimistically: the list shows in the sidebar at once and
 * is swapped for the server's version (or removed when the server refuses).
 */
import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import type { ApiClient } from '../../api/client';
import type { TaskListCreate, TaskListRead, TaskListUpdate, TaskRead } from '../../api/schema';
import { detachList, restoreTaskLists, revertListUpdate } from '../../domain/listCache';
import {
  beginTaskMutation,
  endTaskMutation,
  beginTaskWrite,
  endTaskWrite,
} from '../tasks/pendingMutations';
import { taskKeys } from '../tasks/taskQueries';
import { OPTIMISTIC_ID_PREFIX } from '../tasks/taskMutations';
import { listKeys } from './listQueries';
import { beginListMutation, endListMutation } from './pendingListMutations';

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
      beginListMutation(queryClient);
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
    onSettled: () => {
      if (endListMutation(queryClient)) return queryClient.invalidateQueries({ queryKey: key });
    },
  };
}

export interface UpdateListVariables {
  id: string;
  patch: TaskListUpdate;
}

export function updateListMutation({
  api,
  queryClient,
  now = () => new Date(),
}: ListMutationDeps): MutationOptions<
  TaskListRead,
  Error,
  UpdateListVariables,
  { previous: TaskListRead | undefined }
> {
  const key = listKeys.list();
  return {
    mutationKey: listKeys.mutation(),
    scope: { id: 'lists' },
    meta: { kind: 'updateList' },
    mutationFn: ({ id, patch }) => api.updateList(id, patch),
    onMutate: async ({ id, patch }) => {
      beginListMutation(queryClient);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient
        .getQueryData<TaskListRead[]>(key)
        ?.find((list) => list.id === id);
      queryClient.setQueryData<TaskListRead[]>(key, (lists) =>
        (lists ?? []).map((list) =>
          list.id === id ? { ...list, ...patch, updated_at: now().toISOString() } : list,
        ),
      );
      return { previous };
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<TaskListRead[]>(key, (lists) =>
        (lists ?? []).map((list) => (list.id === updated.id ? updated : list)),
      );
    },
    onError: (_error, { id, patch }, context) => {
      const previous = context?.previous;
      if (previous)
        queryClient.setQueryData<TaskListRead[]>(key, (lists) =>
          (lists ?? []).map((list) =>
            list.id === id ? revertListUpdate(list, previous, patch) : list,
          ),
        );
    },
    onSettled: () => {
      if (endListMutation(queryClient)) return queryClient.invalidateQueries({ queryKey: key });
    },
  };
}

interface DeleteListContext {
  previous: TaskListRead | undefined;
  affected: Set<string>;
}

export function deleteListMutation({
  api,
  queryClient,
}: ListMutationDeps): MutationOptions<void, Error, string, DeleteListContext> {
  const key = listKeys.list();
  const tasksKey = taskKeys.list();
  return {
    mutationKey: listKeys.mutation(),
    scope: { id: 'lists' },
    meta: { kind: 'deleteList' },
    mutationFn: (id) => api.deleteList(id),
    onMutate: async (id) => {
      beginListMutation(queryClient);
      beginTaskMutation(queryClient);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: key }),
        queryClient.cancelQueries({ queryKey: tasksKey }),
      ]);
      const previous = queryClient
        .getQueryData<TaskListRead[]>(key)
        ?.find((list) => list.id === id);
      const tasks = queryClient.getQueryData<TaskRead[]>(tasksKey) ?? [];
      const affected = new Set(tasks.filter((task) => task.list_id === id).map((task) => task.id));
      for (const taskId of affected)
        beginTaskWrite(queryClient, taskId, affected, new Set(['list_id']));
      queryClient.setQueryData<TaskListRead[]>(key, (lists) =>
        (lists ?? []).filter((list) => list.id !== id),
      );
      queryClient.setQueryData<TaskRead[]>(tasksKey, (current) => detachList(current ?? [], id));
      return { previous, affected };
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData<TaskRead[]>(tasksKey, (tasks) => detachList(tasks ?? [], id));
    },
    onError: (_error, id, context) => {
      if (!context) return;
      const previous = context.previous;
      if (previous)
        queryClient.setQueryData<TaskListRead[]>(key, (lists) => [
          ...(lists ?? []).filter((list) => list.id !== id),
          previous,
        ]);
      queryClient.setQueryData<TaskRead[]>(tasksKey, (tasks) =>
        restoreTaskLists(tasks ?? [], context.affected, id),
      );
    },
    onSettled: async (_data, _error, _id, context) => {
      const affected = context?.affected;
      if (affected) for (const taskId of affected) endTaskWrite(queryClient, taskId, affected);
      const refresh = [];
      if (endListMutation(queryClient))
        refresh.push(queryClient.invalidateQueries({ queryKey: key }));
      if (endTaskMutation(queryClient))
        refresh.push(queryClient.invalidateQueries({ queryKey: tasksKey }));
      await Promise.all(refresh);
    },
  };
}
