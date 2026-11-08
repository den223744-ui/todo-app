/**
 * Which toast a failed task or list mutation shows. Mutations say what they are via
 * `meta.kind`.
 */
import { ApiError, CLIENT_ERROR_CODES } from '../../api/client';
import { TOAST_TEXTS } from '../../constants/texts';

export type TaskMutationKind = 'create' | 'update' | 'delete' | 'restore' | 'createList';

export interface TaskMutationMeta extends Record<string, unknown> {
  kind?: TaskMutationKind;
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
  if (!meta?.kind) return null;
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
    case 'createList': {
      if (error instanceof ApiError && error.code === 'conflict') return TOAST_TEXTS.listNameTaken;
      const name =
        typeof variables === 'object' && variables !== null && 'name' in variables
          ? String(variables.name)
          : '';
      return TOAST_TEXTS.createListFailed(name);
    }
  }
}
