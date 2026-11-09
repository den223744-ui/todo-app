import type { TaskListRead, TaskRead, TaskUpdate } from '../../api/schema';
import { SEARCH_TEXTS, TEXTS } from '../../constants/texts';
import type { TaskGroup } from '../../domain/taskGroups';
import { dayHeading } from '../../domain/dayHeading';
import { selectSubtasks } from '../../domain/subtasks';
import type { AppLocation } from '../../domain/view';
import { GroupBadge } from './GroupBadge';
import { TaskRow } from './TaskRow';

interface TaskListProps {
  groups: TaskGroup[];
  location: AppLocation;
  now: Date;
  /** Tasks with a write in flight. */
  busyIds: ReadonlySet<string>;
  onToggle: (task: TaskRead) => void;
  onOpen: (id: string) => void;
  editingId: string | null;
  onStartEdit: (id: string) => void;
  onRename: (task: TaskRead, patch: TaskUpdate) => void;
  onStopEdit: () => void;
  lists?: readonly TaskListRead[] | undefined;
  onDelete?: ((task: TaskRead) => void) | undefined;
  tasks?: readonly TaskRead[];
  onMoveToToday?: ((task: TaskRead) => void) | undefined;
}

export function TaskList({
  groups,
  location,
  now,
  busyIds,
  onToggle,
  onOpen,
  editingId,
  onStartEdit,
  onRename,
  onStopEdit,
  lists = [],
  onDelete,
  tasks = [],
  onMoveToToday,
}: TaskListProps) {
  const byId = new Map(lists.map((list) => [list.id, list]));
  return (
    // Each group is a labelled section; a plain div may not carry aria-label.
    <div className="space-y-7">
      {groups.map((group) => {
        const title =
          group.list !== undefined
            ? (group.list?.name ?? TEXTS.noList)
            : group.key === 'all'
              ? null
              : group.key === 'search:open'
                ? SEARCH_TEXTS.found
                : group.key === 'search:completed'
                  ? SEARCH_TEXTS.completed
                  : group.key === 'tomorrow'
                    ? TEXTS.tomorrow
                    : dayHeading(group.key, now);
        return (
          <section key={group.key} aria-label={title ?? TEXTS.taskList}>
            {title && (
              <div className="mb-3 flex items-center gap-3">
                <GroupBadge list={group.list} />
                <h2 className="font-display text-[22px] font-bold tracking-tight text-ink first-letter:uppercase">
                  {title}
                </h2>
                <span className="text-xs text-ink-faint">
                  {TEXTS.taskCount(group.tasks.length)}
                </span>
              </div>
            )}
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-transparent">
              {group.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  location={location}
                  now={now}
                  busy={busyIds.has(task.id)}
                  onToggle={onToggle}
                  onOpen={onOpen}
                  editing={editingId === task.id}
                  onStartEdit={onStartEdit}
                  onRename={onRename}
                  onStopEdit={onStopEdit}
                  list={task.list_id ? byId.get(task.list_id) : undefined}
                  onDelete={onDelete}
                  subtasks={selectSubtasks(tasks, task.id)}
                  busyIds={busyIds}
                  timeOnly={
                    group.key === 'tomorrow' ||
                    (!location.query.trim() &&
                      location.view.kind === 'list' &&
                      location.view.list === 'upcoming')
                  }
                  onMoveToToday={onMoveToToday}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
