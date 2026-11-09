/**
 * Typed HTTP client for the backend API.
 *
 * Request and response types come from the generated `schema.ts`, so a change
 * in the backend contract becomes a type error here. Server state is cached by
 * TanStack Query on top of this client (see the task hooks).
 *
 * Session handling (see backend/app/core/session.py):
 * - The anonymous session (an httpOnly cookie) is created by the first GET.
 *   If a new visitor sent several first requests in parallel, each would get
 *   its own workspace and the browser would keep only the last cookie. So
 *   until a session exists, the first request goes alone and the others wait.
 * - A write without a valid session gets 401 `session_required`. The client
 *   then starts a session once (shared by concurrent callers) and retries the
 *   request once. Retrying is safe: the server refuses before doing anything.
 */
import type { paths } from './schema';

type Json<T> = T extends { content: { 'application/json': infer Body } } ? Body : never;

type TasksPath = paths['/api/tasks'];
type TaskPath = paths['/api/tasks/{task_id}'];
type RestorePath = paths['/api/tasks/{task_id}/restore'];
type ListsPath = paths['/api/lists'];
type ListPath = paths['/api/lists/{list_id}'];

export type ListTasksResponse = Json<TasksPath['get']['responses'][200]>;
export type CreateTaskBody = Json<NonNullable<TasksPath['post']['requestBody']>>;
export type CreateTaskResponse = Json<TasksPath['post']['responses'][201]>;
export type UpdateTaskBody = Json<NonNullable<TaskPath['patch']['requestBody']>>;
export type UpdateTaskResponse = Json<TaskPath['patch']['responses'][200]>;
export type RestoreTaskResponse = Json<RestorePath['post']['responses'][200]>;
export type ListListsResponse = Json<ListsPath['get']['responses'][200]>;
export type CreateListBody = Json<NonNullable<ListsPath['post']['requestBody']>>;
export type CreateListResponse = Json<ListsPath['post']['responses'][201]>;
export type UpdateListBody = Json<NonNullable<ListPath['patch']['requestBody']>>;
export type UpdateListResponse = Json<ListPath['patch']['responses'][200]>;

/** Error codes produced by the client itself, next to the server's codes. */
export const CLIENT_ERROR_CODES = {
  network: 'network_error',
  http: 'http_error',
  invalidResponse: 'invalid_response',
} as const;

export const SESSION_REQUIRED = 'session_required';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export interface ApiClient {
  listTasks(options?: { signal?: AbortSignal }): Promise<ListTasksResponse>;
  createTask(body: CreateTaskBody): Promise<CreateTaskResponse>;
  updateTask(id: string, body: UpdateTaskBody): Promise<UpdateTaskResponse>;
  deleteTask(id: string): Promise<void>;
  restoreTask(id: string): Promise<RestoreTaskResponse>;
  listLists(options?: { signal?: AbortSignal }): Promise<ListListsResponse>;
  createList(body: CreateListBody): Promise<CreateListResponse>;
  updateList(id: string, body: UpdateListBody): Promise<UpdateListResponse>;
  deleteList(id: string): Promise<void>;
}

export interface ApiClientOptions {
  fetch?: typeof fetch;
  baseUrl?: string;
}

interface RequestSpec {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  signal?: AbortSignal | undefined;
}

const TASKS_PATH = '/api/tasks';
const LISTS_PATH = '/api/lists';

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  const doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  const baseUrl = options.baseUrl ?? '';

  let sessionStarted = false;
  // The first request while no session exists; everyone else waits for it.
  let gate: Promise<unknown> | null = null;
  // A running "start session" request, shared by concurrent 401 retries.
  let sessionStart: Promise<void> | null = null;

  async function send(spec: RequestSpec): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const init: RequestInit = { method: spec.method, credentials: 'same-origin', headers };
    if (spec.body !== undefined) {
      init.body = JSON.stringify(spec.body);
      headers['Content-Type'] = 'application/json';
    }
    if (spec.signal) {
      init.signal = spec.signal;
    }
    try {
      return await doFetch(`${baseUrl}${spec.path}`, init);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error; // cancellation is not a failure; TanStack Query expects it as is
      }
      throw new ApiError(0, CLIENT_ERROR_CODES.network, 'Network request failed');
    }
  }

  async function toApiError(response: Response): Promise<ApiError> {
    try {
      const body: unknown = await response.json();
      if (isErrorBody(body)) {
        return new ApiError(response.status, body.error.code, body.error.message);
      }
    } catch {
      // Not JSON (e.g. a proxy error page): fall through to a generic error.
    }
    return new ApiError(response.status, CLIENT_ERROR_CODES.http, response.statusText || 'Error');
  }

  function startSession(): Promise<void> {
    sessionStart ??= (async () => {
      try {
        const response = await send({ method: 'GET', path: TASKS_PATH });
        if (!response.ok) {
          throw await toApiError(response);
        }
        sessionStarted = true;
      } finally {
        sessionStart = null;
      }
    })();
    return sessionStart;
  }

  async function sendWithSessionRetry(spec: RequestSpec): Promise<Response> {
    const response = await send(spec);
    if (response.status !== 401) {
      return response;
    }
    const error = await toApiError(response);
    if (error.code !== SESSION_REQUIRED) {
      throw error;
    }
    sessionStarted = false;
    await startSession();
    return send(spec);
  }

  async function request(spec: RequestSpec): Promise<Response> {
    while (!sessionStarted && gate) {
      await gate.catch(() => undefined);
    }
    if (sessionStarted) {
      return sendWithSessionRetry(spec);
    }
    // No session yet and nobody else is starting one: this request goes alone.
    const attempt = sendWithSessionRetry(spec).then((response) => {
      // Any HTTP answer means the server has seen us; a failed network
      // request leaves the gate open for the next request to try.
      if (response.status < 500) {
        sessionStarted = true;
      }
      return response;
    });
    gate = attempt;
    try {
      return await attempt;
    } finally {
      gate = null;
    }
  }

  async function json<T>(spec: RequestSpec): Promise<T> {
    const response = await request(spec);
    if (!response.ok) {
      throw await toApiError(response);
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError(
        response.status,
        CLIENT_ERROR_CODES.invalidResponse,
        'Response is not valid JSON',
      );
    }
  }

  const taskPath = (id: string) => `${TASKS_PATH}/${encodeURIComponent(id)}`;
  const listPath = (id: string) => `${LISTS_PATH}/${encodeURIComponent(id)}`;
  const remove = async (path: string) => {
    const response = await request({ method: 'DELETE', path });
    if (!response.ok) {
      throw await toApiError(response);
    }
  };

  return {
    listTasks: (opts) => json({ method: 'GET', path: TASKS_PATH, signal: opts?.signal }),
    createTask: (body) => json({ method: 'POST', path: TASKS_PATH, body }),
    updateTask: (id, body) => json({ method: 'PATCH', path: taskPath(id), body }),
    deleteTask: (id) => remove(taskPath(id)),
    restoreTask: (id) => json({ method: 'POST', path: `${taskPath(id)}/restore` }),
    listLists: (opts) => json({ method: 'GET', path: LISTS_PATH, signal: opts?.signal }),
    createList: (body) => json({ method: 'POST', path: LISTS_PATH, body }),
    updateList: (id, body) => json({ method: 'PATCH', path: listPath(id), body }),
    deleteList: (id) => remove(listPath(id)),
  };
}

function isErrorBody(body: unknown): body is { error: { code: string; message: string } } {
  if (typeof body !== 'object' || body === null || !('error' in body)) {
    return false;
  }
  const error: unknown = body.error;
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    'message' in error &&
    typeof error.message === 'string'
  );
}
