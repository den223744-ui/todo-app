import { useMutationState } from '@tanstack/react-query';

import { TEXTS } from '../../constants/texts';
import { selectTaskGroups } from '../../domain/taskGroups';
import { useAppLocation } from '../navigation/useAppLocation';
import { useNow } from '../time/useNow';
import { TaskList } from './TaskList';
import { TaskListEmpty } from './TaskListEmpty';
import { TaskListSkeleton } from './TaskListSkeleton';
import { mutationTaskId } from './taskMutations';
import { taskKeys } from './taskQueries';
import { useTasks, useUpdateTask } from './useTasks';

export function TaskListContainer() {
  const { data, isPending, isError, refetch } = useTasks();
  const update = useUpdateTask();
  // Only the tasks being written are locked; the rest stay usable (optimistic UI).
  const busyIds = new Set(
    useMutationState({
      filters: { mutationKey: taskKeys.mutation(), status: 'pending' },
      select: (mutation) => mutationTaskId(mutation.state.variables),
    }).filter((id): id is string => id !== null),
  );
  const now = useNow();
  const [location, navigate] = useAppLocation();
  const groups = selectTaskGroups(data ?? [], location, now);

  return (
    <div className="mt-6 space-y-4">
      {isError && (
        <div role="alert" className="rounded-lg border border-line bg-surface p-4 text-sm">
          <p className="text-danger">{data ? TEXTS.refreshTasksError : TEXTS.loadTasksError}</p>
          <button
            type="button"
            onClick={() => {
              void refetch();
            }}
            className="mt-2 min-h-11 rounded-lg px-3 text-accent-ink hover:bg-accent-soft"
          >
            {TEXTS.retry}
          </button>
        </div>
      )}
      {update.isError && (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border border-line bg-surface p-4 text-sm"
        >
          <p className="flex-1 text-danger">{TEXTS.updateTaskError}</p>
          <button
            type="button"
            onClick={() => {
              update.reset();
            }}
            className="min-h-11 rounded-lg px-3 text-ink-muted hover:bg-subtle"
          >
            {TEXTS.dismissError}
          </button>
        </div>
      )}
      {isPending ? (
        <TaskListSkeleton />
      ) : (
        data &&
        (groups.length === 0 ? (
          <TaskListEmpty location={location} />
        ) : (
          <TaskList
            groups={groups}
            now={now}
            location={location}
            busyIds={busyIds}
            onToggle={(task) => {
              update.mutate({ id: task.id, patch: { completed: task.completed_at === null } });
            }}
            onOpen={(taskId) => {
              navigate({ taskId });
            }}
          />
        ))
      )}
    </div>
  );
}
