import { useRef } from 'react';
import { useIsPresent } from 'framer-motion';
import type { TaskRead } from '../../api/schema';
import { useMutationState } from '@tanstack/react-query';

import { EDIT_TEXTS, UNDO_TEXTS } from '../../constants/texts';
import { subtasksOf } from '../../domain/taskEdit';
import { useAppLocation } from '../navigation/useAppLocation';
import { OPTIMISTIC_ID_PREFIX, mutationTaskId } from '../tasks/taskMutations';
import { taskKeys } from '../tasks/taskQueries';
import { useTasks } from '../tasks/useTasks';
import { useUndoableCreate } from '../tasks/useUndoableCreate';
import { DetailsPanel } from './DetailsPanel';
import { useLists } from '../lists/useLists';
import { useTaskActions } from '../tasks/useTaskActions';
import { TaskDetails } from './TaskDetails';

const rowLink = (taskId: string) =>
  document.querySelector<HTMLElement>(`[data-task-link="${CSS.escape(taskId)}"]`);

/** Focus the task's row link again after the panel closes. */
function focusTaskRow(taskId: string) {
  requestAnimationFrame(() => {
    const row = rowLink(taskId);
    const target =
      row && !row.closest('[hidden]')
        ? row
        : document.querySelector<HTMLElement>(`[data-timeline-task="${CSS.escape(taskId)}"]`);
    target?.focus();
  });
}

/**
 * Where focus goes when the open task is deleted: the next task in the list,
 * else the previous one, else the quick add field. Found before the delete,
 * while the row is still there.
 */
function focusTargetAfterDelete(taskId: string): HTMLElement | null {
  const rows = [...document.querySelectorAll<HTMLElement>('[data-task-link]')].filter(
    (row) => !row.closest('[hidden], [inert], [aria-hidden="true"]'),
  );
  const index = rows.findIndex((row) => row.dataset.taskLink === taskId);
  return (
    rows[index + 1] ??
    rows[index - 1] ??
    document.querySelector<HTMLElement>('[data-quick-add-input]')
  );
}

/** Shows the task from ?task=<id> in the detail panel. */
export function TaskDetailsContainer() {
  const [location, navigate] = useAppLocation();
  const { data } = useTasks();
  const create = useUndoableCreate();
  const actions = useTaskActions();
  const { data: lists } = useLists();
  const busyIds = new Set(
    useMutationState({
      filters: { mutationKey: taskKeys.mutation(), status: 'pending' },
      select: (mutation) => mutationTaskId(mutation.state.variables),
    }).filter((id): id is string => id !== null),
  );

  const present = useIsPresent();
  const previous = useRef<{ id: string; task: TaskRead | undefined } | null>(null);
  const taskId = present ? location.taskId : (previous.current?.id ?? null);
  if (taskId === null || data === undefined) return null;
  const task = present ? data.find((candidate) => candidate.id === taskId) : previous.current?.task;
  if (present) previous.current = { id: taskId, task };

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
            if (patch.completed !== undefined && Object.keys(patch).length === 1) {
              actions.toggle(target);
              return;
            }
            const message =
              'list_id' in patch
                ? UNDO_TEXTS.movedToList(
                    lists?.find((list) => list.id === patch.list_id)?.name ?? EDIT_TEXTS.noList,
                  )
                : 'due_date' in patch || 'due_time' in patch
                  ? UNDO_TEXTS.dateChanged
                  : UNDO_TEXTS.changed;
            actions.change(target, patch, message);
          }}
          onCreateSubtask={(title) => create({ title, parent_id: task.id })}
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
