import { MutationObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, type ApiClient } from '../../api/client';
import { createQueryClient } from '../../api/queryClient';
import type { TaskListRead, TaskRead } from '../../api/schema';
import { makeList } from '../../test/makeList';
import { makeTask } from '../../test/makeTask';
import { hasPendingTaskMutations } from '../tasks/pendingMutations';
import { taskKeys } from '../tasks/taskQueries';

import {
  LIST_COLORS,
  createListMutation,
  updateListMutation,
  deleteListMutation,
} from './listMutations';
import { listKeys } from './listQueries';
import { hasPendingListMutations } from './pendingListMutations';

const NOW = new Date('2026-11-08T12:00:00.000Z');
const FAIL = new ApiError(409, 'conflict', 'taken');

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function fakeApi(createList: ApiClient['createList']): ApiClient {
  const unexpected = () => Promise.reject(new Error('unexpected call'));
  return {
    listTasks: vi.fn(unexpected),
    createTask: vi.fn(unexpected),
    updateTask: vi.fn(unexpected),
    deleteTask: vi.fn(unexpected),
    restoreTask: vi.fn(unexpected),
    listLists: vi.fn(() => Promise.resolve(cached())),
    createList,
    updateList: vi.fn(unexpected),
    deleteList: vi.fn(unexpected),
  };
}

let queryClient = createQueryClient();
const cached = () => queryClient.getQueryData<TaskListRead[]>(listKeys.list()) ?? [];
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function setup(api: ApiClient, lists: TaskListRead[]) {
  queryClient = createQueryClient();
  queryClient.setQueryData(listKeys.list(), lists);
  return new MutationObserver(
    queryClient,
    createListMutation({ api, queryClient, now: () => NOW, newId: () => 'optimistic-1' }),
  );
}

afterEach(() => {
  queryClient.clear();
});

describe('updateListMutation', () => {
  it('updates name, colour and position optimistically, then takes the server answer', async () => {
    const server = deferred<TaskListRead>();
    const api = fakeApi(vi.fn());
    const update = vi.fn(() => server.promise);
    api.updateList = update;
    const work = makeList({ id: 'work' });
    setup(api, [work]);
    const observer = new MutationObserver(
      queryClient,
      updateListMutation({ api, queryClient, now: () => NOW }),
    );
    const done = observer.mutate({
      id: 'work',
      patch: { name: 'Новое', color: 'green', position: 3 },
    });
    await flush();
    expect(cached()[0]).toMatchObject({
      name: 'Новое',
      color: 'green',
      position: 3,
      updated_at: NOW.toISOString(),
    });
    expect(hasPendingListMutations(queryClient)).toBe(true);
    const saved = { ...work, name: 'Новое', color: 'green' as const, position: 3 };
    server.resolve(saved);
    await done;
    expect(cached()).toEqual([saved]);
    expect(update).toHaveBeenCalledWith('work', { name: 'Новое', color: 'green', position: 3 });
    expect(hasPendingListMutations(queryClient)).toBe(false);
  });
  it('rolls back only the failed list, preserving another pending change and unrelated fields', async () => {
    const first = deferred<TaskListRead>();
    const api = fakeApi(vi.fn());
    api.updateList = vi.fn(() => first.promise);
    const work = makeList({ id: 'work', name: 'Работа' });
    const home = makeList({ id: 'home', name: 'Дом' });
    setup(api, [work, home]);
    const observer = new MutationObserver(queryClient, updateListMutation({ api, queryClient }));
    const done = observer.mutate({ id: 'work', patch: { name: 'Дом' } });
    const rejected = expect(done).rejects.toBe(FAIL);
    await flush();
    queryClient.setQueryData(
      listKeys.list(),
      cached().map((list) => ({ ...list, color: 'red' })),
    );
    first.reject(FAIL);
    await rejected;
    expect(cached()).toEqual([
      { ...work, color: 'red' },
      { ...home, color: 'red' },
    ]);
  });
});

describe('deleteListMutation', () => {
  it('removes the list and detaches its tasks at once, then refetches both caches', async () => {
    const server = deferred<undefined>();
    const api = fakeApi(vi.fn());
    const remove = vi.fn(() => server.promise);
    api.deleteList = remove;
    setup(api, [makeList({ id: 'work' }), makeList({ id: 'home' })]);
    const tasks = [
      makeTask({ id: 'a', list_id: 'work' }),
      makeTask({ id: 'b', list_id: 'home' }),
      makeTask({ id: 'c' }),
    ];
    queryClient.setQueryData(taskKeys.list(), tasks);
    const observer = new MutationObserver(queryClient, deleteListMutation({ api, queryClient }));
    const done = observer.mutate('work');
    await flush();
    expect(cached().map((list) => list.id)).toEqual(['home']);
    expect(queryClient.getQueryData<TaskRead[]>(taskKeys.list())).toEqual([
      { ...tasks[0], list_id: null },
      tasks[1],
      tasks[2],
    ]);
    expect(hasPendingTaskMutations(queryClient)).toBe(true);
    server.resolve(undefined);
    await done;
    expect(remove).toHaveBeenCalledWith('work');
    expect(hasPendingTaskMutations(queryClient)).toBe(false);
    expect(hasPendingListMutations(queryClient)).toBe(false);
    expect(queryClient.getQueryState(taskKeys.list())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(listKeys.list())?.isInvalidated).toBe(true);
  });
  it('restores list assignment on failure without losing task edits or new tasks/lists', async () => {
    const server = deferred<undefined>();
    const api = fakeApi(vi.fn());
    api.deleteList = vi.fn(() => server.promise);
    const work = makeList({ id: 'work' });
    setup(api, [work]);
    const task = makeTask({ id: 'a', list_id: 'work' });
    queryClient.setQueryData(taskKeys.list(), [task]);
    const observer = new MutationObserver(queryClient, deleteListMutation({ api, queryClient }));
    const done = observer.mutate('work');
    const rejected = expect(done).rejects.toBe(FAIL);
    await flush();
    queryClient.setQueryData(taskKeys.list(), [
      { ...task, list_id: null, title: 'Changed' },
      makeTask({ id: 'new' }),
    ]);
    queryClient.setQueryData(listKeys.list(), [makeList({ id: 'new-list' })]);
    server.reject(FAIL);
    await rejected;
    expect(cached().map((list) => list.id)).toEqual(['new-list', 'work']);
    expect(queryClient.getQueryData<TaskRead[]>(taskKeys.list())).toEqual([
      { ...task, title: 'Changed' },
      makeTask({ id: 'new' }),
    ]);
  });
});

describe('createListMutation', () => {
  it('shows the list at once with the next colour, then swaps in the server version', async () => {
    const server = deferred<TaskListRead>();
    const observer = setup(
      fakeApi(() => server.promise),
      [makeList({ id: 'work', position: 3 })],
    );

    const done = observer.mutate({ name: '  Дом ' });
    await flush();
    expect(cached()[1]).toMatchObject({
      id: 'optimistic-1',
      name: 'Дом',
      color: LIST_COLORS[1],
      position: 4,
      created_at: NOW.toISOString(),
    });

    server.resolve(makeList({ id: 'home', name: 'Дом', color: 'brown', position: 4 }));
    await done;
    expect(cached().map((list) => list.id)).toEqual(['work', 'home']);
  });

  it('keeps a given colour and position', async () => {
    const server = deferred<TaskListRead>();
    const observer = setup(
      fakeApi(() => server.promise),
      [],
    );

    const done = observer.mutate({ name: 'Ок', color: 'olive', position: 0.5 });
    await flush();
    expect(cached()[0]).toMatchObject({ color: 'olive', position: 0.5 });

    server.resolve(makeList({ id: 'ok', color: 'olive', position: 0.5 }));
    await done;
  });

  it('removes the optimistic list when the server refuses', async () => {
    const work = makeList({ id: 'work' });
    const observer = setup(
      fakeApi(() => Promise.reject(FAIL)),
      [work],
    );

    await expect(observer.mutate({ name: 'Работа' })).rejects.toBe(FAIL);

    expect(cached()).toEqual([work]);
  });
});
