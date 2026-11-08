import type { TaskRead, TaskUpdate } from '../../api/schema';
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
}

const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

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
}: TaskListProps) {
  return (
    // Each group is a labelled section; a plain div may not carry aria-label.
    <div className="space-y-6">
      {groups.map((group) => {
        const title =
          group.list !== undefined
            ? (group.list?.name ?? TEXTS.noList)
            : group.key === 'all'
              ? null
              : dayFormat.format(new Date(`${group.key}T00:00:00`));
        return (
          <section key={group.key} aria-label={title ?? TEXTS.taskList}>
            {title && <h2 className="mb-2 text-xs font-medium text-ink-muted">{title}</h2>}
            <ul className="space-y-2">
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
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
