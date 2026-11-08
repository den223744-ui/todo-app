import type { TaskRead } from '../../api/schema';
import { PRIORITY_LABELS, TEXTS } from '../../constants/texts';
import { toLocalDateString } from '../../domain/dates';
import { isOverdue } from '../../domain/smartLists';
import { serializeLocation, type AppLocation } from '../../domain/view';

interface TaskRowProps {
  task: TaskRead;
  now: Date;
  location: AppLocation;
  pending: boolean;
  onToggle: (task: TaskRead) => void;
  onOpen: (id: string) => void;
}

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function TaskRow({ task, now, location, pending, onToggle, onOpen }: TaskRowProps) {
  const completed = task.completed_at !== null;
  const overdue = isOverdue(task, toLocalDateString(now));
  const selected = location.taskId === task.id;

  return (
    <li
      className={`flex items-start rounded-lg border ${selected ? 'border-accent-ink bg-accent-soft' : 'border-line bg-surface hover:bg-subtle'}`}
    >
      <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center pt-1">
        <input
          type="checkbox"
          checked={completed}
          disabled={pending}
          aria-label={completed ? TEXTS.reopenTask(task.title) : TEXTS.completeTask(task.title)}
          onChange={() => {
            onToggle(task);
          }}
          className="size-4 cursor-pointer accent-accent disabled:cursor-wait"
        />
      </label>
      <a
        href={serializeLocation({ ...location, taskId: task.id })}
        aria-current={selected ? 'true' : undefined}
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.ctrlKey ||
            event.metaKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          onOpen(task.id);
        }}
        className="min-w-0 flex-1 rounded-lg py-3 pr-4"
      >
        <span
          className={`block text-sm leading-5 wrap-anywhere ${completed ? 'text-ink-faint line-through' : 'text-ink'}`}
        >
          {task.title}
        </span>
        {(task.due_date || task.priority > 0 || task.tags.length > 0) && (
          <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            {task.due_date && (
              <time
                dateTime={task.due_time ? `${task.due_date}T${task.due_time}` : task.due_date}
                className={overdue ? 'text-danger' : undefined}
              >
                {dateFormat.format(new Date(`${task.due_date}T00:00:00`))}
                {task.due_time && `, ${task.due_time.slice(0, 5)}`}
              </time>
            )}
            {task.priority > 0 && (
              <span
                className={
                  task.priority === 3
                    ? 'text-danger'
                    : task.priority === 2
                      ? 'text-warning'
                      : 'text-ink-muted'
                }
              >
                {PRIORITY_LABELS[task.priority]}
              </span>
            )}
            {task.tags.map((tag) => (
              <span
                key={tag}
                aria-label={TEXTS.taskTag(tag)}
                className="max-w-full rounded bg-subtle px-1.5 py-0.5 wrap-anywhere"
              >
                #{tag}
              </span>
            ))}
          </span>
        )}
      </a>
    </li>
  );
}
