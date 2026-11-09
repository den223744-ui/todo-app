import { useMutationState } from '@tanstack/react-query';

import { TEXTS } from '../../constants/texts';
import { useUiStore } from '../../store/uiStore';
import { selectTaskGroups } from '../../domain/taskGroups';
import { selectList } from '../../domain/smartLists';
import { useAppLocation } from '../navigation/useAppLocation';
import { useNow } from '../time/useNow';
import { TaskList } from './TaskList';
import { TaskListEmpty } from './TaskListEmpty';
import { TaskListSkeleton } from './TaskListSkeleton';
import { mutationTaskId, OPTIMISTIC_ID_PREFIX } from './taskMutations';
import { taskKeys } from './taskQueries';
import { useLists } from '../lists/useLists';
import { useTaskActions } from './useTaskActions';
import { useTasks, useUpdateTask } from './useTasks';

export function TaskListContainer() {
  const { data, isPending, isError, refetch } = useTasks();
  const update = useUpdateTask();
  const actions = useTaskActions();
  // Only the tasks being written are locked; the rest stay usable (optimistic UI).
  const busyIds = new Set(
    useMutationState({
      filters: { mutationKey: taskKeys.mutation(), status: 'pending' },
      select: (mutation) => mutationTaskId(mutation.state.variables),
    }).filter((id): id is string => id !== null),
  );
  const now = useNow();
  const [location, navigate] = useAppLocation();
  const editingId = useUiStore((state) => state.editingTaskId);
  const startEditing = useUiStore((state) => state.startEditing);
  const stopEditing = useUiStore((state) => state.stopEditing);
  const { data: lists } = useLists();
  const groups = selectTaskGroups(data ?? [], lists ?? [], location, now);
  const overdue = selectList(data ?? [], 'overdue', now);

  return (
    <div className="mt-6 space-y-4">
      {location.view.kind === 'list' &&
        location.view.list === 'overdue' &&
        !location.query.trim() &&
        overdue.length > 0 && (
          <button
            type="button"
            disabled={overdue.some(
              (task) => busyIds.has(task.id) || task.id.startsWith(OPTIMISTIC_ID_PREFIX),
            )}
            onClick={() => {
              actions.moveToToday(overdue, new Date());
            }}
            className="min-h-11 rounded-lg border border-line px-3 text-sm text-ink-muted hover:text-accent-ink disabled:opacity-50"
          >
            {TEXTS.moveAllToToday(overdue.length)}
          </button>
        )}
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
              actions.toggle(task);
            }}
            onOpen={(taskId) => {
              navigate({ taskId });
            }}
            editingId={editingId}
            onStartEdit={startEditing}
            onRename={(task, patch) => {
              update.mutate({ id: task.id, patch });
            }}
            onStopEdit={stopEditing}
            lists={lists}
            tasks={data}
            onMoveToToday={(task) => {
              actions.moveToToday([task], new Date());
            }}
            onDelete={(task) => {
              actions.destroy(task);
              navigate({ taskId: null });
            }}
          />
        ))
      )}
    </div>
  );
}
