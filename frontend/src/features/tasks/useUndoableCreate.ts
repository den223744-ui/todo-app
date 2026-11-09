import type { TaskCreate, TaskRead } from '../../api/schema';
import { UNDO_TEXTS } from '../../constants/texts';
import { useToastStore, type ToastOptions } from '../../store/toastStore';
import { parseLocation } from '../../domain/view';
import { navigateTo } from '../navigation/useAppLocation';
import { focusQuickAdd } from '../shortcuts/focus';
import { UNDO_MS } from './useTaskActions';
import { useCreateTask, useDeleteTask } from './useTasks';

/** Offer undo immediately. Its closure belongs to this request, even after unmount. */
export function useUndoableCreate() {
  const create = useCreateTask();
  const remove = useDeleteTask();
  return (
    input: TaskCreate,
    feedback?: (task: TaskRead) => { message: string; options: ToastOptions },
  ) => {
    const result = create.mutateAsync(input);
    const store = useToastStore.getState();
    const toastId = store.showToast(UNDO_TEXTS.added, {
      duration: UNDO_MS,
      deduplicate: false,
      action: {
        label: UNDO_TEXTS.undo,
        undo: true,
        run: () => {
          // No temporary id ever reaches DELETE. A rejected POST needs no compensation.
          void result.then(
            (saved) => {
              if (parseLocation(window.location.search).taskId === saved.id) {
                navigateTo({ taskId: null });
                requestAnimationFrame(focusQuickAdd);
              }
              remove.mutate(saved.id);
            },
            () => undefined,
          );
        },
      },
    });
    void result.then(
      (saved) => {
        if (toastId === null || !feedback) return;
        const next = feedback(saved);
        // Updating never recreates a dismissed/undone toast or restarts its lifetime.
        store.updateToast(toastId, next.message, next.options);
      },
      () => {
        if (toastId !== null) store.dismissToast(toastId);
      },
    );
    return result;
  };
}
