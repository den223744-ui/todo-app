/**
 * Optimistic mutations, driven through TanStack Query's own MutationObserver
 * (the same machinery useMutation uses), without rendering React.
 */
import {
  MutationObserver,
  QueryObserver,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, type ApiClient } from '../../api/client';
import { createQueryClient } from '../../api/queryClient';
import type { TaskRead } from '../../api/schema';
import { makeTask } from '../../test/makeTask';
import {
  OPTIMISTIC_ID_PREFIX,
  createTaskMutation,
  deleteTaskMutation,
  restoreTaskMutation,
  updateTaskMutation,
  type MutationDeps,
} from './taskMutations';
import { hasPendingTaskMutations } from './pendingMutations';
import { taskKeys, tasksQueryOptions } from './taskQueries';

const NOW = new Date('2026-11-08T12:00:00.000Z');
const FAIL = new ApiError(500, 'internal_error', 'boom');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeApi(overrides: Partial<ApiClient> = {}): ApiClient {
  const unexpected = () => Promise.reject(new Error('unexpected call'));
  return {
    listTasks: vi.fn(unexpected),
    createTask: vi.fn(unexpected),
    updateTask: vi.fn(unexpected),
    deleteTask: vi.fn(unexpected),
    restoreTask: vi.fn(unexpected),
    ...overrides,
  };
}

let queryClient = createQueryClient();

function setup(api: ApiClient, tasks: TaskRead[]): MutationDeps {
  queryClient = createQueryClient();
  // What QueryClientProvider does: wires focus and online events to the client.
  queryClient.mount();
  queryClient.setQueryData(taskKeys.list(), tasks);
  let counter = 0;
  return {
    api,
    queryClient,
    now: () => NOW,
    newId: () => `${OPTIMISTIC_ID_PREFIX}${String(++counter)}`,
  };
}

afterEach(() => {
  queryClient.unmount();
  queryClient.clear();
});

const cached = () => queryClient.getQueryData<TaskRead[]>(taskKeys.list()) ?? [];
const cachedIds = () => cached().map((task) => task.id);
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Keep the list query active, as a mounted useTasks() would; returns unsubscribe. */
function watchList(deps: MutationDeps): () => void {
  const observer = new QueryObserver(queryClient, tasksQueryOptions(deps.api, queryClient));
  return observer.subscribe(() => undefined);
}

/** Make the cached list stale without refetching it (as time passing would). */
async function markStale(): Promise<void> {
  await queryClient.invalidateQueries({ queryKey: taskKeys.list(), refetchType: 'none' });
}

const A = makeTask({ id: 'a', position: 1 });
const B = makeTask({ id: 'b', position: 2 });

describe('tasksQueryOptions', () => {
  it('loads the list with the query signal', async () => {
    const listTasks = vi.fn(() => Promise.resolve([A]));
    const client = createQueryClient();
    const observer = new QueryObserver(client, tasksQueryOptions(fakeApi({ listTasks }), client));

    const result = await observer.refetch();

    expect(result.data).toEqual([A]);
    expect(listTasks).toHaveBeenCalledWith({ signal: expect.any(AbortSignal) as AbortSignal });
    client.clear();
  });
});

describe('create', () => {
  it('shows the task at once and swaps in the server version', async () => {
    const server = deferred<TaskRead>();
    const deps = setup(fakeApi({ createTask: () => server.promise }), [A]);
    const observer = new MutationObserver(queryClient, createTaskMutation(deps));

    const done = observer.mutate({ title: ' Купить молоко ', tags: ['#Дом'] });
    await flush();
    expect(cached()[1]).toMatchObject({
      id: `${OPTIMISTIC_ID_PREFIX}1`,
      title: 'Купить молоко',
      tags: ['дом'],
      position: 2,
    });

    const created = makeTask({ id: 'real', title: 'Купить молоко', position: 2 });
    server.resolve(created);
    await done;
    expect(cachedIds()).toEqual(['a', 'real']);
  });

  it('removes the optimistic task when the server fails', async () => {
    const deps = setup(fakeApi({ createTask: () => Promise.reject(FAIL) }), [A]);
    const observer = new MutationObserver(queryClient, createTaskMutation(deps));

    await expect(observer.mutate({ title: 'x' })).rejects.toBe(FAIL);

    expect(cachedIds()).toEqual(['a']);
  });
});

describe('update', () => {
  it('applies the patch at once and keeps the server version', async () => {
    const server = deferred<TaskRead>();
    const deps = setup(fakeApi({ updateTask: () => server.promise }), [A, B]);
    const observer = new MutationObserver(queryClient, updateTaskMutation(deps));

    const done = observer.mutate({ id: 'a', patch: { completed: true } });
    await flush();
    expect(cached()[0]?.completed_at).toBe(NOW.toISOString());

    server.resolve({ ...A, completed_at: '2026-11-08T12:00:01.000Z' });
    await done;
    expect(cached()[0]?.completed_at).toBe('2026-11-08T12:00:01.000Z');
  });

  it('restores the previous version on error', async () => {
    const deps = setup(fakeApi({ updateTask: () => Promise.reject(FAIL) }), [A, B]);
    const observer = new MutationObserver(queryClient, updateTaskMutation(deps));

    await expect(observer.mutate({ id: 'a', patch: { title: 'changed' } })).rejects.toBe(FAIL);

    expect(cached()).toEqual([A, B]);
  });

  it('an earlier answer does not wipe a later edit still in flight', async () => {
    // The server applies writes in order and answers each one when told to.
    let stored: TaskRead = A;
    const answers: Array<() => void> = [];
    const sent: string[][] = [];
    const updateTask = vi.fn(
      (_id: string, patch: { tags?: string[] | null }) =>
        new Promise<TaskRead>((resolve) => {
          sent.push(patch.tags ?? []);
          stored = { ...stored, tags: patch.tags ?? [] };
          const snapshot = stored;
          answers.push(() => {
            resolve(snapshot);
          });
        }),
    );
    const deps = setup(fakeApi({ updateTask }), [A]);
    const observer = () => new MutationObserver(queryClient, updateTaskMutation(deps));
    // Like the tag editor: the new list is built from what the cache shows now.
    const addTag = async (tag: string) => {
      const tags = [...(cached()[0]?.tags ?? []), tag];
      const done = observer().mutate({ id: 'a', patch: { tags } });
      await flush(); // the optimistic change is in the cache before the next edit
      return { done }; // wrapped: returning the promise itself would wait for it
    };

    const first = await addTag('first');
    const second = await addTag('second');
    answers[0]?.(); // the first answer arrives, the second request is still out
    await first.done;
    expect(cached()[0]?.tags).toEqual(['first', 'second']);

    const third = await addTag('third');
    answers[1]?.();
    await second.done;
    await flush();
    answers[2]?.();
    await third.done;

    expect(sent.at(-1)).toEqual(['first', 'second', 'third']);
    expect(cached()[0]?.tags).toEqual(['first', 'second', 'third']);
  });

  it('does nothing extra for a task missing from the cache', async () => {
    const deps = setup(fakeApi({ updateTask: () => Promise.reject(FAIL) }), [A]);
    const observer = new MutationObserver(queryClient, updateTaskMutation(deps));

    await expect(observer.mutate({ id: 'ghost', patch: { title: 'x' } })).rejects.toBe(FAIL);

    expect(cached()).toEqual([A]);
  });
});

describe('delete', () => {
  it('removes the task with its subtasks and returns them for Undo', async () => {
    const sub = makeTask({ id: 's', parent_id: 'a' });
    const server = deferred<undefined>();
    const deps = setup(fakeApi({ deleteTask: () => server.promise }), [A, B, sub]);
    const onMutateResult = vi.fn();
    const options = deleteTaskMutation(deps);
    const observer = new MutationObserver(queryClient, options);
    observer.subscribe((result) => {
      if (result.context) onMutateResult(result.context);
    });

    const done = observer.mutate('a');
    await flush();
    expect(cachedIds()).toEqual(['b']);
    expect(onMutateResult).toHaveBeenCalledWith({ removed: [A, sub] });

    server.resolve(undefined);
    await done;
    expect(cachedIds()).toEqual(['b']);
  });

  it('puts the task and subtasks back on error', async () => {
    const sub = makeTask({ id: 's', parent_id: 'a', position: 3 });
    const deps = setup(fakeApi({ deleteTask: () => Promise.reject(FAIL) }), [A, B, sub]);
    const observer = new MutationObserver(queryClient, deleteTaskMutation(deps));

    await expect(observer.mutate('a')).rejects.toBe(FAIL);

    expect(cachedIds()).toEqual(['a', 'b', 's']);
  });
});

describe('restore', () => {
  it('shows the given tasks at once and keeps the server version', async () => {
    const sub = makeTask({ id: 's', parent_id: 'a', position: 3 });
    const server = deferred<TaskRead>();
    const deps = setup(fakeApi({ restoreTask: () => server.promise }), [B]);
    const observer = new MutationObserver(queryClient, restoreTaskMutation(deps));

    const done = observer.mutate({ id: 'a', tasks: [A, sub] });
    await flush();
    expect(cachedIds()).toEqual(['a', 'b', 's']);

    server.resolve({ ...A, title: 'from server' });
    await done;
    expect(cached()[0]?.title).toBe('from server');
  });

  it('adds the restored task even without optimistic data', async () => {
    const deps = setup(fakeApi({ restoreTask: () => Promise.resolve(A) }), [B]);
    const observer = new MutationObserver(queryClient, restoreTaskMutation(deps));

    await observer.mutate({ id: 'a' });

    expect(cachedIds()).toEqual(['a', 'b']);
  });

  it('removes only what it inserted on error', async () => {
    const deps = setup(fakeApi({ restoreTask: () => Promise.reject(FAIL) }), [B]);
    const observer = new MutationObserver(queryClient, restoreTaskMutation(deps));

    await expect(observer.mutate({ id: 'a', tasks: [A, B] })).rejects.toBe(FAIL);

    expect(cachedIds()).toEqual(['b']);
  });
});

describe('concurrent mutations', () => {
  it('a failing mutation does not undo another one still in flight', async () => {
    const update = deferred<TaskRead>();
    const deps = setup(
      fakeApi({
        updateTask: () => update.promise,
        deleteTask: () => Promise.reject(FAIL),
      }),
      [A, B],
    );
    const updating = new MutationObserver(queryClient, updateTaskMutation(deps));
    const deleting = new MutationObserver(queryClient, deleteTaskMutation(deps));

    const updated = updating.mutate({ id: 'a', patch: { title: 'kept' } });
    await flush();
    await expect(deleting.mutate('b')).rejects.toBe(FAIL);

    // The delete rolled back only itself: B is back, A keeps its pending title.
    expect(cached().map((task) => [task.id, task.title])).toEqual([
      ['a', 'kept'],
      ['b', 'b'],
    ]);

    update.resolve({ ...A, title: 'kept' });
    await updated;
  });

  it('refetches the list once, after the last mutation settles', async () => {
    const first = deferred<TaskRead>();
    const second = deferred<TaskRead>();
    const calls = [first, second];
    const listTasks = vi.fn(() => Promise.resolve([A, B]));
    const deps = setup(
      fakeApi({ listTasks, updateTask: () => calls.shift()?.promise ?? Promise.reject(FAIL) }),
      [A, B],
    );
    const list = watchList(deps);
    const one = new MutationObserver(queryClient, updateTaskMutation(deps));
    const two = new MutationObserver(queryClient, updateTaskMutation(deps));

    const p1 = one.mutate({ id: 'a', patch: { title: '1' } });
    const p2 = two.mutate({ id: 'b', patch: { title: '2' } });
    await flush();

    first.resolve({ ...A, title: '1' });
    await p1;
    await flush();
    expect(listTasks).not.toHaveBeenCalled();

    second.resolve({ ...B, title: '2' });
    await p2;
    await flush();
    expect(listTasks).toHaveBeenCalledTimes(1);
    list();
  });

  it('refetches even when the last two mutations settle in the same tick', async () => {
    const first = deferred<TaskRead>();
    const second = deferred<TaskRead>();
    const calls = [first, second];
    const listTasks = vi.fn(() => Promise.resolve([A, B]));
    const deps = setup(
      fakeApi({ listTasks, updateTask: () => calls.shift()?.promise ?? Promise.reject(FAIL) }),
      [A, B],
    );
    const list = watchList(deps);
    const one = new MutationObserver(queryClient, updateTaskMutation(deps));
    const two = new MutationObserver(queryClient, updateTaskMutation(deps));

    const both = Promise.all([
      one.mutate({ id: 'a', patch: { title: '1' } }),
      two.mutate({ id: 'b', patch: { title: '2' } }),
    ]);
    await flush();
    first.resolve({ ...A, title: '1' });
    second.resolve({ ...B, title: '2' });
    await both;
    await flush();

    expect(listTasks).toHaveBeenCalledTimes(1);
    list();
  });

  it.each([
    [
      'window focus',
      () => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      },
    ],
    [
      'reconnect',
      () => {
        onlineManager.setOnline(false);
        onlineManager.setOnline(true);
      },
    ],
  ])('a %s refetch waits while a mutation is pending', async (_name, trigger) => {
    const update = deferred<TaskRead>();
    const listTasks = vi.fn(() => Promise.resolve([A]));
    const deps = setup(fakeApi({ listTasks, updateTask: () => update.promise }), [A]);
    const list = watchList(deps);
    const observer = new MutationObserver(queryClient, updateTaskMutation(deps));

    const done = observer.mutate({ id: 'a', patch: { title: 'new' } });
    await flush();
    // The request hangs longer than staleTime: the optimistic data turns stale.
    await markStale();
    trigger();
    await flush();

    expect(listTasks).not.toHaveBeenCalled();
    expect(cached()[0]?.title).toBe('new');

    update.resolve({ ...A, title: 'new' });
    await done;
    await flush();
    expect(listTasks).toHaveBeenCalledTimes(1);
    list();
    focusManager.setFocused(undefined);
    onlineManager.setOnline(true);
  });

  it('a mutation whose onMutate throws does not leave the counter stuck', async () => {
    const listTasks = vi.fn(() => Promise.resolve([A]));
    const deps = setup(fakeApi({ listTasks }), [A]);
    const list = watchList(deps);
    const broken = createTaskMutation({
      ...deps,
      newId: () => {
        throw new Error('no id');
      },
    });
    const observer = new MutationObserver(queryClient, broken);

    await expect(observer.mutate({ title: 'x' })).rejects.toThrow('no id');
    await flush();

    expect(hasPendingTaskMutations(queryClient)).toBe(false);
    expect(cachedIds()).toEqual(['a']);
    expect(listTasks).toHaveBeenCalledTimes(1); // the settle refetch still ran
    list();
  });

  it('a mutation paused offline stays pending and settles after reconnect', async () => {
    const listTasks = vi.fn(() => Promise.resolve([{ ...A, title: 'new' }]));
    const updateTask = vi.fn(() => Promise.resolve({ ...A, title: 'new' }));
    const deps = setup(fakeApi({ listTasks, updateTask }), [A]);
    const list = watchList(deps);
    onlineManager.setOnline(false);
    const observer = new MutationObserver(queryClient, updateTaskMutation(deps));

    const done = observer.mutate({ id: 'a', patch: { title: 'new' } });
    await flush();
    expect(updateTask).not.toHaveBeenCalled(); // paused: no network
    expect(hasPendingTaskMutations(queryClient)).toBe(true);
    expect(cached()[0]?.title).toBe('new'); // the optimistic change is visible offline

    onlineManager.setOnline(true);
    await done;
    await flush();

    expect(updateTask).toHaveBeenCalledTimes(1);
    expect(hasPendingTaskMutations(queryClient)).toBe(false);
    expect(listTasks).toHaveBeenCalledTimes(1);
    list();
  });

  it('background refetches run normally when nothing is pending', async () => {
    const listTasks = vi.fn(() => Promise.resolve([A]));
    const deps = setup(fakeApi({ listTasks }), [A]);
    const list = watchList(deps);
    await markStale();

    focusManager.setFocused(false);
    focusManager.setFocused(true);
    await flush();

    expect(listTasks).toHaveBeenCalledTimes(1);
    list();
    focusManager.setFocused(undefined);
  });

  it('cancels a running list fetch so it cannot overwrite the optimistic state', async () => {
    const list = deferred<TaskRead[]>();
    const update = deferred<TaskRead>();
    const deps = setup(
      fakeApi({ listTasks: () => list.promise, updateTask: () => update.promise }),
      [A],
    );
    const fetching = queryClient.query({
      ...tasksQueryOptions(deps.api, queryClient),
      staleTime: 0,
    });
    const observer = new MutationObserver(queryClient, updateTaskMutation(deps));

    const done = observer.mutate({ id: 'a', patch: { title: 'new' } });
    await flush();
    list.resolve([A]); // a stale answer, started before the change
    await fetching.catch(() => undefined);
    await flush();

    // While the server has not answered the update, the user still sees it.
    expect(cached()[0]?.title).toBe('new');

    update.resolve({ ...A, title: 'new' });
    await done;
  });
});
