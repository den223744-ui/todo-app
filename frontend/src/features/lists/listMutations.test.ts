import { MutationObserver } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, type ApiClient } from '../../api/client';
import { createQueryClient } from '../../api/queryClient';
import type { TaskListRead } from '../../api/schema';
import { makeList } from '../../test/makeList';
import { LIST_COLORS, createListMutation } from './listMutations';
import { listKeys } from './listQueries';

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
