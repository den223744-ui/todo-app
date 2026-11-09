import type { TaskListRead, TaskRead } from '../../api/schema';
import { TaskTitle } from '../../components/TaskTitle';
import { toLocalDateString } from '../../domain/dates';
import { isOverdue } from '../../domain/smartLists';

import { PriorityMark } from './PriorityMark';

const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

interface TaskRowSummaryProps {
  task: TaskRead;
  now: Date;
  /** The task's list, for the coloured chip. */
  list?: TaskListRead | undefined;
  /** Rows under a day heading show only the time. */
  timeOnly: boolean;
}

/** Title, priority, list and tag chips and the due date of a task row. */
export function TaskRowSummary({ task, now, list, timeOnly }: TaskRowSummaryProps) {
  const today = toLocalDateString(now);
  const overdue = isOverdue(task, today);
  return (
    // A narrow list (phone, or the middle column beside the timeline): the title
    // gets its own line, the date goes under it. By the list's width, not the window's.
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 @md:flex-nowrap">
      <span className="flex min-w-0 flex-1 basis-full items-center gap-2 @md:basis-auto">
        <TaskTitle
          completed={task.completed_at !== null}
          className="min-w-0 text-[13.5px] leading-5 wrap-break-word"
        >
          {task.title}
        </TaskTitle>
        {task.priority > 0 && <PriorityMark priority={task.priority} />}
      </span>
      {(list || task.tags.length > 0) && (
        <span className="hidden max-w-[45%] flex-wrap justify-end gap-1.5 @md:flex">
          {list && (
            <span
              className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium"
              style={{
                borderColor: `var(--list-${list.color})`,
                color: `var(--list-${list.color}-ink)`,
              }}
            >
              {list.name}
            </span>
          )}
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="max-w-full rounded-full border border-line px-2.5 py-0.5 text-[11px] text-ink-muted wrap-anywhere"
            >
              #{tag}
            </span>
          ))}
        </span>
      )}
      {task.due_date && (!timeOnly || task.due_time) && (
        <time
          dateTime={task.due_time ? `${task.due_date}T${task.due_time}` : task.due_date}
          className={`shrink-0 text-left text-xs tabular-nums @md:w-24 @md:text-right ${overdue ? 'text-danger' : 'text-ink-muted'}`}
        >
          {timeOnly || task.due_date === today
            ? (task.due_time?.slice(0, 5) ?? '')
            : `${dateFormat.format(new Date(`${task.due_date}T00:00:00`))}${
                task.due_time ? `, ${task.due_time.slice(0, 5)}` : ''
              }`}
        </time>
      )}
    </span>
  );
}
