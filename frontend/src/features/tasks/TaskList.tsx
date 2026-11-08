import type { TaskListRead, TaskRead, TaskUpdate } from '../../api/schema';
import { TEXTS } from '../../constants/texts';
import type { TaskGroup } from '../../domain/taskGroups';
import type { AppLocation } from '../../domain/view';
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
}

const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** The rounded square before a group title: the list's folder, or a calendar. */
function GroupBadge({ list }: { list: TaskListRead | null | undefined }) {
  const color = list?.color;
  return (
    <span
      aria-hidden="true"
      className="flex size-7 items-center justify-center rounded-lg border border-line text-ink-muted"
      style={
        color ? { borderColor: `var(--list-${color})`, color: `var(--list-${color})` } : undefined
      }
    >
      <svg
        className="size-4"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        {list === undefined ? (
          <path d="M4 5.5h12v10.5H4zM4 8.5h12M7 3.5v3M13 3.5v3" strokeLinecap="round" />
        ) : (
          <path
            d="M2.5 5.5A1.5 1.5 0 0 1 4 4h3.6a1.5 1.5 0 0 1 1.1.48L9.9 5.8H16a1.5 1.5 0 0 1 1.5 1.5v7.2A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5Z"
            fill="currentColor"
            stroke="none"
          />
        )}
      </svg>
    </span>
  );
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
              : group.key === 'tomorrow'
                ? TEXTS.tomorrow
                : dayFormat.format(new Date(`${group.key}T00:00:00`));
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
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
