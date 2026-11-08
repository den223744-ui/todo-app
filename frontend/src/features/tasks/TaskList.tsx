import type { TaskRead } from '../../api/schema';
import { LIST_TITLES, TEXTS } from '../../constants/texts';
import type { TaskGroup } from '../../domain/taskGroups';
import type { AppLocation } from '../../domain/view';
import { TaskRow } from './TaskRow';

interface TaskListProps {
  groups: TaskGroup[];
  location: AppLocation;
  now: Date;
  pending: boolean;
  onToggle: (task: TaskRead) => void;
  onOpen: (id: string) => void;
}

const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function TaskList({ groups, location, now, pending, onToggle, onOpen }: TaskListProps) {
  return (
    <div aria-label={TEXTS.taskList} className="space-y-6">
      {groups.map((group) => {
        const title =
          group.key === 'all'
            ? null
            : group.key === 'today' || group.key === 'overdue'
              ? LIST_TITLES[group.key]
              : dayFormat.format(new Date(`${group.key}T00:00:00`));
        return (
          <section key={group.key} aria-label={title ?? TEXTS.taskList}>
            {title && (
              <h2
                className={`mb-2 text-xs font-medium ${group.key === 'overdue' ? 'text-danger' : 'text-ink-muted'}`}
              >
                {title}
              </h2>
            )}
            <ul className="space-y-2">
              {group.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  location={location}
                  now={now}
                  pending={pending}
                  onToggle={onToggle}
                  onOpen={onOpen}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
