/**
 * Which toast a failed task mutation shows. Mutations say what they are via
 * `meta.kind`; `meta.silent` is for callers that report the error themselves
 * (quick add shows it next to the field).
 */
import { ApiError, CLIENT_ERROR_CODES } from '../../api/client';
import { TOAST_TEXTS } from '../../constants/texts';

export type TaskMutationKind = 'create' | 'update' | 'delete' | 'restore';

export interface TaskMutationMeta extends Record<string, unknown> {
  kind?: TaskMutationKind;
  silent?: boolean;
}

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: TaskMutationMeta;
  }
}

export function mutationErrorToast(
  meta: TaskMutationMeta | undefined,
  variables: unknown,
  error: unknown,
): string | null {
  if (!meta?.kind || meta.silent) return null;
  if (error instanceof ApiError && error.code === CLIENT_ERROR_CODES.network) {
    return TOAST_TEXTS.offline;
  }
  switch (meta.kind) {
    case 'create': {
      const title =
        typeof variables === 'object' && variables !== null && 'title' in variables
          ? String(variables.title)
          : '';
      return TOAST_TEXTS.createFailed(title);
    }
    case 'update':
      return TOAST_TEXTS.updateFailed;
    case 'delete':
      return TOAST_TEXTS.deleteFailed;
    case 'restore':
      return TOAST_TEXTS.restoreFailed;
  }
}
