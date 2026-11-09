import { createApiClient } from './client';

/** The app-wide client: one session state for the whole page. */
export const api = createApiClient();
