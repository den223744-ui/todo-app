import { createApiClient } from './client';

export { ApiError, CLIENT_ERROR_CODES, SESSION_REQUIRED, createApiClient } from './client';
export type { ApiClient } from './client';
export type {
  ErrorResponse,
  TaskCreate,
  TaskListCreate,
  TaskListRead,
  TaskListUpdate,
  TaskRead,
  TaskUpdate,
} from './schema';

/** The app-wide client: one session state for the whole page. */
export const api = createApiClient();
