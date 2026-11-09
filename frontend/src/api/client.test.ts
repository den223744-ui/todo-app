import { describe, expect, it, vi } from 'vitest';

import { ApiError, CLIENT_ERROR_CODES, createApiClient } from './client';
import type { TaskRead } from './schema';

const TASK: TaskRead = {
  id: '6f1c1c3e-8a4b-4a49-9a4f-3f8a8f0f2d11',
  parent_id: null,
  list_id: null,
  title: 'Купить молоко',
  notes: null,
  priority: 0,
  due_date: null,
  due_time: null,
  duration_minutes: null,
  tags: [],
  position: 1,
  completed_at: null,
  created_at: '2026-11-08T10:00:00Z',
  updated_at: '2026-11-08T10:00:00Z',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const apiError = (status: number, code: string, message = code) =>
  json({ error: { code, message } }, status);

interface Call {
  url: string;
  method: string;
  body: unknown;
  init: RequestInit;
}

/** fetch double that answers from a queue of handlers and records calls. */
function fakeFetch(...handlers: ((call: Call) => Response | Promise<Response>)[]) {
  const calls: Call[] = [];
  const fetch = vi.fn((input: RequestInfo | URL, init: RequestInit = {}) => {
    const call: Call = {
      url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      method: init.method ?? 'GET',
      body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      init,
    };
    calls.push(call);
    const handler = handlers.shift();
    if (!handler) {
      return Promise.reject(new Error(`unexpected request ${call.method} ${call.url}`));
    }
    return Promise.resolve(handler(call));
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

/** A response the test releases by hand, to control interleaving. */
function deferred() {
  let resolve!: (response: Response) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A client whose session is already established. */
async function startedClient(...handlers: ((call: Call) => Response | Promise<Response>)[]) {
  const fake = fakeFetch(() => json([]), ...handlers);
  const client = createApiClient({ fetch: fake.fetch });
  await client.listTasks();
  fake.calls.length = 0;
  return { client, calls: fake.calls };
}

describe('requests', () => {
  it('lists tasks', async () => {
    const { fetch, calls } = fakeFetch(() => json([TASK]));

    await expect(createApiClient({ fetch }).listTasks()).resolves.toEqual([TASK]);

    expect(calls[0]).toMatchObject({ url: '/api/tasks', method: 'GET', body: undefined });
    expect(calls[0]?.init.credentials).toBe('same-origin');
  });

  it('creates, updates and restores with JSON bodies', async () => {
    const { client, calls } = await startedClient(
      () => json(TASK, 201),
      () => json(TASK),
      () => json(TASK),
    );

    await client.createTask({ title: 'Купить молоко' });
    await client.updateTask(TASK.id, { completed: true });
    await client.restoreTask(TASK.id);

    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ['POST', '/api/tasks', { title: 'Купить молоко' }],
      ['PATCH', `/api/tasks/${TASK.id}`, { completed: true }],
      ['POST', `/api/tasks/${TASK.id}/restore`, undefined],
    ]);
    expect(new Headers(calls[0]?.init.headers).get('Content-Type')).toBe('application/json');
    expect(new Headers(calls[2]?.init.headers).has('Content-Type')).toBe(false);
  });

  it('deletes without expecting a body', async () => {
    const { client, calls } = await startedClient(() => new Response(null, { status: 204 }));

    await expect(client.deleteTask(TASK.id)).resolves.toBeUndefined();
    expect(calls[0]).toMatchObject({ method: 'DELETE', url: `/api/tasks/${TASK.id}` });
  });

  it('escapes ids in the path and honours the base URL', async () => {
    const { fetch, calls } = fakeFetch(
      () => json([]),
      () => json(TASK),
    );
    const client = createApiClient({ fetch, baseUrl: 'https://api.example' });

    await client.listTasks();
    await client.updateTask('a/b', {});

    expect(calls.map((c) => c.url)).toEqual([
      'https://api.example/api/tasks',
      'https://api.example/api/tasks/a%2Fb',
    ]);
  });

  it('passes the abort signal through and keeps AbortError as is', async () => {
    const controller = new AbortController();
    const { fetch, calls } = fakeFetch(() => {
      throw new DOMException('aborted', 'AbortError');
    });

    const result = createApiClient({ fetch }).listTasks({ signal: controller.signal });

    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls[0]?.init.signal).toBe(controller.signal);
  });
});

describe('errors', () => {
  it('turns the API error body into ApiError', async () => {
    const { client } = await startedClient(() => apiError(404, 'not_found', 'Task not found'));

    const error = await client.updateTask(TASK.id, {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: 'not_found', message: 'Task not found' });
  });

  it('turns a non-JSON error page into http_error', async () => {
    const { client } = await startedClient(
      () => new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }),
    );

    await expect(client.createTask({ title: 't' })).rejects.toMatchObject({
      status: 502,
      code: CLIENT_ERROR_CODES.http,
      message: 'Bad Gateway',
    });
  });

  it('uses a generic message when JSON is not an API error', async () => {
    const { client } = await startedClient(() => json({ detail: 'x' }, 500));

    await expect(client.deleteTask(TASK.id)).rejects.toMatchObject({
      status: 500,
      code: CLIENT_ERROR_CODES.http,
      message: 'Error',
    });
  });

  it.each([
    { error: 'x' },
    { error: { code: 1, message: 'm' } },
    { error: { code: 'c' } },
    { error: null },
    null,
  ])('rejects malformed error body %j', async (body) => {
    const { client } = await startedClient(() => json(body, 400));

    await expect(client.createTask({ title: 't' })).rejects.toMatchObject({
      code: CLIENT_ERROR_CODES.http,
    });
  });

  it('turns a network failure into network_error', async () => {
    const { client } = await startedClient(() => {
      throw new TypeError('Failed to fetch');
    });

    await expect(client.listTasks()).rejects.toMatchObject({
      status: 0,
      code: CLIENT_ERROR_CODES.network,
    });
  });

  it('reports a success response that is not JSON', async () => {
    const { client } = await startedClient(() => new Response('oops', { status: 200 }));

    await expect(client.listTasks()).rejects.toMatchObject({
      code: CLIENT_ERROR_CODES.invalidResponse,
    });
  });
});

describe('session: first request goes alone', () => {
  it('holds back other requests until the first one has answered', async () => {
    const first = deferred();
    const { fetch, calls } = fakeFetch(
      () => first.promise,
      () => json(TASK, 201),
      () => json(TASK, 201),
    );
    const client = createApiClient({ fetch });

    const list = client.listTasks();
    const createA = client.createTask({ title: 'a' });
    const createB = client.createTask({ title: 'b' });
    await flush();
    expect(calls).toHaveLength(1); // the writes wait for the session

    first.resolve(json([]));
    await Promise.all([list, createA, createB]);
    expect(calls.map((c) => c.method)).toEqual(['GET', 'POST', 'POST']);
  });

  it('runs requests in parallel once the session exists', async () => {
    const a = deferred();
    const b = deferred();
    const { client, calls } = await startedClient(
      () => a.promise,
      () => b.promise,
    );

    const first = client.listTasks();
    const second = client.listTasks();
    await flush();
    expect(calls).toHaveLength(2);

    a.resolve(json([]));
    b.resolve(json([]));
    await Promise.all([first, second]);
  });

  it('lets the next request lead when the first one failed on the network', async () => {
    const first = deferred();
    const { fetch, calls } = fakeFetch(
      () => first.promise,
      () => json([]),
      () => json([]),
    );
    const client = createApiClient({ fetch });

    const failed = client.listTasks();
    const second = client.listTasks();
    const third = client.listTasks();
    first.reject(new TypeError('offline'));

    await expect(failed).rejects.toMatchObject({ code: CLIENT_ERROR_CODES.network });
    await Promise.all([second, third]);
    expect(calls).toHaveLength(3);
  });

  it('does not treat a 5xx answer as a started session', async () => {
    const second = deferred();
    const { fetch, calls } = fakeFetch(
      () => apiError(500, 'internal_error'),
      () => second.promise,
      () => json([]),
    );
    const client = createApiClient({ fetch });

    await expect(client.listTasks()).rejects.toMatchObject({ status: 500 });
    const retry = client.listTasks();
    const parallel = client.listTasks();
    await flush();
    expect(calls).toHaveLength(2); // still gated: the server dropped that session

    second.resolve(json([]));
    await Promise.all([retry, parallel]);
  });
});

describe('session: session_required', () => {
  it('starts a session and retries a write once', async () => {
    const { client, calls } = await startedClient(
      () => apiError(401, 'session_required'),
      () => json([]),
      () => json(TASK, 201),
    );

    await expect(client.createTask({ title: 't' })).resolves.toEqual(TASK);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      'POST /api/tasks',
      'GET /api/tasks',
      'POST /api/tasks',
    ]);
  });

  it('starts the session for a first write sent without one', async () => {
    const { fetch, calls } = fakeFetch(
      () => apiError(401, 'session_required'),
      () => json([]),
      () => json(TASK, 201),
    );

    await createApiClient({ fetch }).createTask({ title: 't' });

    expect(calls.map((c) => c.method)).toEqual(['POST', 'GET', 'POST']);
  });

  it('shares one session start between concurrent 401s', async () => {
    const session = deferred();
    const { client, calls } = await startedClient(
      () => apiError(401, 'session_required'),
      () => apiError(401, 'session_required'),
      () => session.promise,
      () => json(TASK),
      () => json(TASK),
    );

    const a = client.updateTask('a', {});
    const b = client.updateTask('b', {});
    await flush();
    session.resolve(json([]));
    await Promise.all([a, b]);

    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(1);
    expect(calls.filter((c) => c.method === 'PATCH')).toHaveLength(4);
  });

  it('gives up after one retry', async () => {
    const { client, calls } = await startedClient(
      () => apiError(401, 'session_required'),
      () => json([]),
      () => apiError(401, 'session_required', 'still no session'),
    );

    await expect(client.deleteTask(TASK.id)).rejects.toMatchObject({
      status: 401,
      code: 'session_required',
      message: 'still no session',
    });
    expect(calls).toHaveLength(3);
  });

  it('fails the write when the session cannot be started', async () => {
    const { client } = await startedClient(
      () => apiError(401, 'session_required'),
      () => apiError(503, 'unavailable'),
    );

    await expect(client.createTask({ title: 't' })).rejects.toMatchObject({
      status: 503,
      code: 'unavailable',
    });
  });

  it('does not retry other 401 errors', async () => {
    const { client, calls } = await startedClient(() => apiError(401, 'unauthorized'));

    await expect(client.createTask({ title: 't' })).rejects.toMatchObject({
      code: 'unauthorized',
    });
    expect(calls).toHaveLength(1);
  });
});
