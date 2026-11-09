/**
 * Optimistic task mutations.
 *
 * Every mutation changes the cached list immediately (onMutate), puts the
 * server's answer in place on success, and on error undoes exactly its own
 * change — not by restoring a whole-list snapshot, which would also wipe the
 * optimistic changes of other mutations still in flight. While any task
 * mutation is pending, background refetches are held off; when the last one
 * settles, the list is refetched once to converge with the server.
 */
import type { MutationOptions, QueryClient } from '@tanstack/react-query';

import type { ApiClient } from '../../api/client';
import type { TaskCreate, TaskRead, TaskUpdate } from '../../api/schema';
import {
  buildOptimisticTask,
  insertTasks,
  removeTaskWithSubtasks,
  patchedFields,
  removeTasks,
  replaceTask,
  revertUpdate,
  updateTask,
  type TaskField,
} from '../../domain/taskCache';

import {
  beginTaskMutation,
  beginTaskWrite,
  endTaskMutation,
  endTaskWrite,
  fieldsWrittenLater,
  pendingTaskWrites,
} from './pendingMutations';
import { preserveTaskKey } from './taskPresentation';
import { taskKeys } from './taskQueries';
import { enqueueTaskWrite } from './writeQueue';

export interface MutationDeps {
  api: ApiClient;
  queryClient: QueryClient;
  now?: () => Date;
  newId?: () => string;
}

export const OPTIMISTIC_ID_PREFIX = 'optimistic-';

const defaultNow = () => new Date();
const defaultNewId = () => `${OPTIMISTIC_ID_PREFIX}${crypto.randomUUID()}`;

type ListUpdater = (tasks: TaskRead[]) => TaskRead[];

function helpers({ queryClient }: MutationDeps) {
  const listKey = taskKeys.list();
  return {
    /**
     * Start of every onMutate: count the mutation in (synchronously, before any
     * await) and stop a list fetch already running, so its older answer cannot
     * overwrite the optimistic state. New fetches are held off while mutations
     * are pending (see tasksQueryOptions).
     */
    begin: async (write?: { taskId: string; key: unknown; fields?: ReadonlySet<TaskField> }) => {
      beginTaskMutation(queryClient);
      if (write) beginTaskWrite(queryClient, write.taskId, write.key, write.fields);
      await queryClient.cancelQueries({ queryKey: listKey });
    },
    read: () => queryClient.getQueryData<TaskRead[]>(listKey) ?? [],
    write: (update: ListUpdater) => {
      queryClient.setQueryData<TaskRead[]>(listKey, (tasks) => update(tasks ?? []));
    },
    /** True when no later write to this task is waiting: its answer may replace the task. */
    isLatestWrite: (taskId: string) => pendingTaskWrites(queryClient, taskId) <= 1,
    /** The last mutation to settle refetches the list once. */
    settle: async (write?: { taskId: string; key: unknown }) => {
      if (write) endTaskWrite(queryClient, write.taskId, write.key);
      if (endTaskMutation(queryClient)) {
        await queryClient.invalidateQueries({ queryKey: listKey });
      }
    },
  };
}

export function createTaskMutation(
  deps: MutationDeps,
): MutationOptions<TaskRead, Error, TaskCreate, { optimisticId: string }> {
  const { begin, read, write, settle } = helpers(deps);
  const now = deps.now ?? defaultNow;
  const newId = deps.newId ?? defaultNewId;
  return {
    mutationKey: taskKeys.mutation(),
    meta: { kind: 'create' },
    mutationFn: (input) => deps.api.createTask(input),
    onMutate: async (input) => {
      await begin();
      const optimisticId = newId();
      write((tasks) =>
        insertTasks(tasks, [buildOptimisticTask(input, optimisticId, read(), now())]),
      );
      return { optimisticId };
    },
    onSuccess: (created, _input, context) => {
      preserveTaskKey(deps.queryClient, created.id, context.optimisticId);
      write((tasks) => replaceTask(tasks, context.optimisticId, created));
    },
    onError: (_error, _input, context) => {
      if (context) write((tasks) => removeTasks(tasks, new Set([context.optimisticId])));
    },
    onSettled: () => settle(),
  };
}

export interface UpdateTaskVariables {
  id: string;
  patch: TaskUpdate;
}

export function updateTaskMutation(
  deps: MutationDeps,
): MutationOptions<TaskRead, Error, UpdateTaskVariables, { previous: TaskRead | undefined }> {
  const { begin, read, write, settle, isLatestWrite } = helpers(deps);
  const now = deps.now ?? defaultNow;
  return {
    mutationKey: taskKeys.mutation(),
    meta: { kind: 'update' },
    mutationFn: ({ id, patch }) => enqueueTaskWrite(id, () => deps.api.updateTask(id, patch)),
    onMutate: async (variables) => {
      const { id, patch } = variables;
      await begin({ taskId: id, key: variables, fields: patchedFields(patch) });
      const previous = read().find((task) => task.id === id);
      write((tasks) => updateTask(tasks, id, patch, now()));
      return { previous };
    },
    onSuccess: (updated) => {
      // A later write to this task is still pending: the cache already shows
      // its change on top of this one, and its own answer will bring both.
      if (isLatestWrite(updated.id)) write((tasks) => replaceTask(tasks, updated.id, updated));
    },
    onError: (_error, variables, context) => {
      const previous = context?.previous;
      if (!previous) return;
      const { id, patch } = variables;
      // Undo only this write's fields. Its snapshot may already hold an
      // earlier write's optimistic change (which may itself have failed), and
      // a later write may set some of the same fields again: those keep their
      // value, which is on its way to the server.
      const keep = fieldsWrittenLater(deps.queryClient, id, variables);
      const last = isLatestWrite(id);
      write((tasks) => {
        const current = tasks.find((task) => task.id === id);
        if (!current) return tasks;
        const reverted = revertUpdate(current, previous, patch, keep);
        return replaceTask(
          tasks,
          id,
          last ? { ...reverted, updated_at: previous.updated_at } : reverted,
        );
      });
    },
    onSettled: (_data, _error, variables) => settle({ taskId: variables.id, key: variables }),
  };
}

export interface DeleteTaskContext {
  /** The task and its subtasks as they were; Undo can show them again at once. */
  removed: TaskRead[];
}

export function deleteTaskMutation(
  deps: MutationDeps,
): MutationOptions<void, Error, string, DeleteTaskContext> {
  const { begin, write, settle } = helpers(deps);
  const { queryClient } = deps;
  return {
    mutationKey: taskKeys.mutation(),
    meta: { kind: 'delete' },
    mutationFn: (id) => enqueueTaskWrite(id, () => deps.api.deleteTask(id)),
    onMutate: async (id) => {
      await begin({ taskId: id, key: id });
      const current = queryClient.getQueryData<TaskRead[]>(taskKeys.list()) ?? [];
      const { removed } = removeTaskWithSubtasks(current, id);
      write((tasks) => removeTaskWithSubtasks(tasks, id).tasks);
      return { removed };
    },
    onError: (_error, _id, context) => {
      if (context) write((tasks) => insertTasks(tasks, context.removed));
    },
    onSettled: (_data, _error, id) => settle({ taskId: id, key: id }),
  };
}

export interface RestoreTaskVariables {
  id: string;
  /** What to show right away (e.g. DeleteTaskContext.removed); the server decides the rest. */
  tasks?: TaskRead[];
}

export function restoreTaskMutation(
  deps: MutationDeps,
): MutationOptions<TaskRead, Error, RestoreTaskVariables, { inserted: Set<string> }> {
  const { begin, read, write, settle, isLatestWrite } = helpers(deps);
  return {
    mutationKey: taskKeys.mutation(),
    meta: { kind: 'restore' },
    mutationFn: ({ id }) => enqueueTaskWrite(id, () => deps.api.restoreTask(id)),
    onMutate: async (variables) => {
      const { id, tasks = [] } = variables;
      await begin({ taskId: id, key: variables });
      const present = new Set(read().map((task) => task.id));
      const inserted = new Set(tasks.map((task) => task.id).filter((id) => !present.has(id)));
      write((current) => insertTasks(current, tasks));
      return { inserted };
    },
    onSuccess: (restored) => {
      write((tasks) =>
        insertTasks(
          isLatestWrite(restored.id) ? replaceTask(tasks, restored.id, restored) : tasks,
          [restored],
        ),
      );
    },
    onError: (_error, _variables, context) => {
      if (context) write((tasks) => removeTasks(tasks, context.inserted));
    },
    onSettled: (_data, _error, variables) => settle({ taskId: variables.id, key: variables }),
  };
}

/** The task a mutation writes: update/restore send {id}, delete sends the id, create none. */
export function mutationTaskId(variables: unknown): string | null {
  if (typeof variables === 'string') return variables;
  if (typeof variables === 'object' && variables !== null && 'id' in variables) {
    return typeof variables.id === 'string' ? variables.id : null;
  }
  return null;
}
