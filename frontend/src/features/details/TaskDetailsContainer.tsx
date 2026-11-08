import { useMutationState } from '@tanstack/react-query';

import { EDIT_TEXTS } from '../../constants/texts';
import { subtasksOf } from '../../domain/taskEdit';
import { useAppLocation } from '../navigation/useAppLocation';
import { OPTIMISTIC_ID_PREFIX, mutationTaskId } from '../tasks/taskMutations';
import { taskKeys } from '../tasks/taskQueries';
import { useCreateTask, useTasks, useUpdateTask } from '../tasks/useTasks';
import { DetailsPanel } from './DetailsPanel';
import { useLists } from '../lists/useLists';
import { useTaskActions } from '../tasks/useTaskActions';
import { TaskDetails } from './TaskDetails';

const rowLink = (taskId: string) =>
  document.querySelector<HTMLElement>(`[data-task-link="${CSS.escape(taskId)}"]`);

/** Focus the task's row link again after the panel closes. */
function focusTaskRow(taskId: string) {
  requestAnimationFrame(() => {
    rowLink(taskId)?.focus();
  });
}

/**
 * Where focus goes when the open task is deleted: the next task in the list,
 * else the previous one, else the quick add field. Found before the delete,
 * while the row is still there.
 */
function focusTargetAfterDelete(taskId: string): HTMLElement | null {
  const row = rowLink(taskId)?.closest('li');
  const neighbour = (element: Element | null | undefined) =>
    element?.querySelector<HTMLElement>('[data-task-link]') ?? null;
  return (
    neighbour(row?.nextElementSibling) ??
    neighbour(row?.previousElementSibling) ??
    document.querySelector<HTMLElement>('[data-quick-add-input]')
  );
}

/** Shows the task from ?task=<id> in the detail panel. */
export function TaskDetailsContainer() {
  const [location, navigate] = useAppLocation();
  const { data } = useTasks();
  const update = useUpdateTask();
  const create = useCreateTask();
  const actions = useTaskActions();
  const { data: lists } = useLists();
  const busyIds = new Set(
    useMutationState({
      filters: { mutationKey: taskKeys.mutation(), status: 'pending' },
      select: (mutation) => mutationTaskId(mutation.state.variables),
    }).filter((id): id is string => id !== null),
  );

  const taskId = location.taskId;
  if (taskId === null || data === undefined) return null;
  const task = data.find((candidate) => candidate.id === taskId);

  const close = () => {
    navigate({ taskId: null });
    focusTaskRow(task?.parent_id ?? taskId);
  };

  return (
    <DetailsPanel taskKey={taskId} onClose={close}>
      {task ? (
        <TaskDetails
          key={task.id}
          task={task}
          subtasks={subtasksOf(data, task.id)}
          busyIds={busyIds}
          canAddSubtasks={!task.id.startsWith(OPTIMISTIC_ID_PREFIX)}
          lists={lists}
          onUpdate={(target, patch) => {
            // Completing goes through the undoable action (toast with «Отменить»).
            if (patch.completed === true && Object.keys(patch).length === 1) {
              actions.toggle(target);
              return;
            }
            update.mutate({ id: target.id, patch });
          }}
          onCreateSubtask={(title) => create.mutateAsync({ title, parent_id: task.id })}
          onDelete={(target) => {
            if (target.id !== task.id) {
              actions.destroy(target); // a subtask: the panel stays
              return;
            }
            const next = focusTargetAfterDelete(task.id);
            actions.destroy(task);
            navigate({ taskId: null });
            requestAnimationFrame(() => next?.focus());
          }}
        />
      ) : (
        <div role="status" className="py-8 text-center">
          <p className="text-sm font-medium">{EDIT_TEXTS.notFound}</p>
          <p className="mt-2 text-sm text-ink-muted">{EDIT_TEXTS.notFoundHint}</p>
        </div>
      )}
    </DetailsPanel>
  );
}
