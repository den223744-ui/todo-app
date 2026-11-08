/**
 * Completing and deleting a task with a way back: each shows a toast with
 * «Отменить» for UNDO_MS (SPEC: Undo toast for 5 s after delete/complete);
 * Ctrl/Cmd+Z runs the newest one (see UndoShortcut).
 */
import { useQueryClient } from '@tanstack/react-query';

import type { TaskRead } from '../../api/schema';
import { UNDO_TEXTS } from '../../constants/texts';
import { removeTaskWithSubtasks } from '../../domain/taskCache';
import { useToastStore } from '../../store/toastStore';
import { taskKeys } from './taskQueries';
import { useDeleteTask, useRestoreTask, useUpdateTask } from './useTasks';

export const UNDO_MS = 5_000;

export function useTaskActions() {
  const queryClient = useQueryClient();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const restore = useRestoreTask();
  const showToast = useToastStore((state) => state.showToast);
  const dismissToast = useToastStore((state) => state.dismissToast);
  // A failed write rolls back and says so in its own toast: its undo offer goes.
  const withdraw = (toastId: number | null) => () => {
    if (toastId !== null) dismissToast(toastId);
  };

  /** Complete or reopen; completing offers undo. */
  const toggle = (task: TaskRead) => {
    const completing = task.completed_at === null;
    if (!completing) {
      update.mutate({ id: task.id, patch: { completed: false } });
      return;
    }
    const toastId = showToast(UNDO_TEXTS.completed(task.title), {
      duration: UNDO_MS,
      action: {
        label: UNDO_TEXTS.undo,
        undo: true,
        run: () => {
          update.mutate({ id: task.id, patch: { completed: false } });
        },
      },
    });
    update.mutate({ id: task.id, patch: { completed: true } }, { onError: withdraw(toastId) });
  };

  /** Delete with its subtasks; undo brings them all back at once. */
  const destroy = (task: TaskRead) => {
    const cached = queryClient.getQueryData<TaskRead[]>(taskKeys.list()) ?? [];
    const { removed } = removeTaskWithSubtasks(cached, task.id);
    const toastId = showToast(UNDO_TEXTS.deleted(task.title), {
      duration: UNDO_MS,
      action: {
        label: UNDO_TEXTS.undo,
        undo: true,
        run: () => {
          restore.mutate({ id: task.id, tasks: removed });
        },
      },
    });
    remove.mutate(task.id, { onError: withdraw(toastId) });
  };

  return { toggle, destroy };
}
