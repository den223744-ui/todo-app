import { useMutationState } from '@tanstack/react-query';

import { EDIT_TEXTS } from '../../constants/texts';
import { subtasksOf } from '../../domain/taskEdit';
import { useAppLocation } from '../navigation/useAppLocation';
import { OPTIMISTIC_ID_PREFIX, mutationTaskId } from '../tasks/taskMutations';
import { taskKeys } from '../tasks/taskQueries';
import { useCreateTask, useDeleteTask, useTasks, useUpdateTask } from '../tasks/useTasks';
import { DetailsPanel } from './DetailsPanel';
import { TaskDetails } from './TaskDetails';

/** Focus the task's row link again after the panel closes. */
function focusTaskRow(taskId: string) {
  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(`[data-task-link="${CSS.escape(taskId)}"]`)?.focus();
  });
}

/** Shows the task from ?task=<id> in the detail panel. */
export function TaskDetailsContainer() {
  const [location, navigate] = useAppLocation();
  const { data } = useTasks();
  const update = useUpdateTask();
  const create = useCreateTask();
  const remove = useDeleteTask();
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
          onUpdate={(target, patch) => {
            update.mutate({ id: target.id, patch });
          }}
          onCreateSubtask={(title) => create.mutateAsync({ title, parent_id: task.id })}
          onDelete={(target) => {
            remove.mutate(target.id);
            if (target.id === task.id) navigate({ taskId: null });
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
