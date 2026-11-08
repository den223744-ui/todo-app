import { useEffect, useRef } from 'react';

import type { TaskListRead, TaskRead, TaskUpdate } from '../../api/schema';
import { PRIORITY_LABELS, TEXTS } from '../../constants/texts';
import { toLocalDateString } from '../../domain/dates';
import { isOverdue } from '../../domain/smartLists';
import { serializeLocation, type AppLocation } from '../../domain/view';
import { InlineTitleEditor } from './InlineTitleEditor';
import { OPTIMISTIC_ID_PREFIX } from './taskMutations';

interface TaskRowProps {
  task: TaskRead;
  now: Date;
  location: AppLocation;
  /** This task has a write in flight: a second toggle would race the first. */
  busy: boolean;
  onToggle: (task: TaskRead) => void;
  onOpen: (id: string) => void;
  /** The title is being edited in place (double click on it). */
  editing: boolean;
  onStartEdit: (id: string) => void;
  onRename: (task: TaskRead, patch: TaskUpdate) => void;
  onStopEdit: () => void;
  /** The task's list, for the coloured chip. */
  list?: TaskListRead | undefined;
}

const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });

const PRIORITY_TONE: Readonly<Record<number, string>> = {
  1: 'text-ink-faint',
  2: 'text-warning',
  3: 'text-accent-ink',
};

/**
 * Priority as a hand-drawn exclamation mark: one, two or three strokes for
 * low, medium and high. The label is for screen readers.
 */
function PriorityMark({ priority }: { priority: number }) {
  const marks = Math.min(Math.max(priority, 1), 3);
  return (
    <span className={`inline-flex shrink-0 ${PRIORITY_TONE[priority] ?? ''}`}>
      <svg
        className="h-3.5"
        style={{ width: `${String(4 + marks * 4)}px` }}
        viewBox={`0 0 ${String(4 + marks * 4)} 16`}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {Array.from({ length: marks }, (_, index) => (
          <g key={index} transform={`translate(${String(4 + index * 4)} 0)`}>
            <path d="M0 2.4 0.2 9.6" />
            <path d="M0.1 13.4v0.1" />
          </g>
        ))}
      </svg>
      <span className="sr-only">{PRIORITY_LABELS[priority]}</span>
    </span>
  );
}

export function TaskRow({
  task,
  now,
  location,
  busy,
  onToggle,
  onOpen,
  editing,
  onStartEdit,
  onRename,
  onStopEdit,
  list,
}: TaskRowProps) {
  const completed = task.completed_at !== null;
  const overdue = isOverdue(task, toLocalDateString(now));
  const selected = location.taskId === task.id;
  const linkRef = useRef<HTMLAnchorElement>(null);
  const wasEditing = useRef(editing);

  // After inline editing ends, keyboard focus returns to the task.
  useEffect(() => {
    if (wasEditing.current && !editing) linkRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  // Not saved yet: the id is temporary and the API does not know it, so the
  // task cannot be opened, renamed or completed until the server answers.
  const unsaved = task.id.startsWith(OPTIMISTIC_ID_PREFIX);
  const locked = busy || unsaved;
  const today = toLocalDateString(now);
  const content = (
    <span className="flex min-w-0 items-center gap-3">
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={`min-w-0 text-[13.5px] leading-5 wrap-anywhere ${completed ? 'text-ink-faint line-through' : 'text-ink'}`}
        >
          {task.title}
        </span>
        {task.priority > 0 && <PriorityMark priority={task.priority} />}
      </span>
      {(list || task.tags.length > 0) && (
        <span className="hidden max-w-[45%] flex-wrap justify-end gap-1.5 sm:flex">
          {list && (
            <span
              className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
              style={{
                backgroundColor: `var(--list-${list.color}-soft)`,
                color: `var(--list-${list.color}-ink)`,
              }}
            >
              {list.name}
            </span>
          )}
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="max-w-full rounded-full bg-subtle px-2.5 py-0.5 text-[11px] text-ink-muted wrap-anywhere"
            >
              #{tag}
            </span>
          ))}
        </span>
      )}
      {task.due_date && (
        <time
          dateTime={task.due_time ? `${task.due_date}T${task.due_time}` : task.due_date}
          className={`w-24 shrink-0 text-right text-xs tabular-nums ${overdue ? 'text-danger' : 'text-ink-muted'}`}
        >
          {task.due_date === today
            ? (task.due_time?.slice(0, 5) ?? '')
            : `${dateFormat.format(new Date(`${task.due_date}T00:00:00`))}${
                task.due_time ? `, ${task.due_time.slice(0, 5)}` : ''
              }`}
        </time>
      )}
    </span>
  );

  return (
    <li className={`flex items-center ${selected ? 'bg-accent-soft' : 'hover:bg-subtle'}`}>
      <label className="flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center pl-1">
        <input
          type="checkbox"
          checked={completed}
          // aria-disabled, not disabled: a disabled element loses keyboard focus.
          aria-disabled={locked || undefined}
          aria-label={completed ? TEXTS.reopenTask(task.title) : TEXTS.completeTask(task.title)}
          onChange={() => {
            if (!locked) onToggle(task);
          }}
          className="size-4 cursor-pointer accent-check aria-disabled:cursor-wait"
        />
      </label>
      {unsaved ? (
        <div aria-busy="true" className="min-w-0 flex-1 py-2.5 pr-4 opacity-70">
          {content}
        </div>
      ) : editing ? (
        <div className="min-w-0 flex-1 py-1.5 pr-4">
          <InlineTitleEditor
            task={task}
            onSave={(patch) => {
              onRename(task, patch);
            }}
            onDone={onStopEdit}
          />
        </div>
      ) : (
        <a
          ref={linkRef}
          data-task-link={task.id}
          href={serializeLocation({ ...location, taskId: task.id })}
          onDoubleClick={(event) => {
            event.preventDefault();
            onStartEdit(task.id);
          }}
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
          className="min-w-0 flex-1 rounded-lg py-2.5 pr-4"
        >
          {content}
        </a>
      )}
    </li>
  );
}
