import type { TaskListRead, TaskRead } from '../../api/schema';
import { TIMELINE_TEXTS } from '../../constants/texts';
import { parseLocalDate } from '../../domain/dates';
import { SLOT_MINUTES, layoutTimeline } from '../../domain/timeline';

interface TimelineProps {
  tasks: readonly TaskRead[];
  lists: readonly TaskListRead[];
  /** The day shown, 'YYYY-MM-DD'. */
  day: string;
  today: string;
  now: Date;
  onOpen: (taskId: string) => void;
}

/** Pixels per hour on the grid. */
const HOUR = 56;

const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const pad = (value: number) => String(value).padStart(2, '0');
const clock = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/**
 * The day as a schedule, as in the mockup: an hour grid with the timed tasks
 * as blocks (coloured by their list), a "now" line on today, and the tasks
 * without a time listed underneath. A block opens the task.
 */
export function Timeline({ tasks, lists, day, today, now, onOpen }: TimelineProps) {
  const layout = layoutTimeline(tasks, day);
  const byId = new Map(lists.map((list) => [list.id, list]));
  const hours = Array.from(
    { length: layout.endHour - layout.startHour + 1 },
    (_, index) => layout.startHour + index,
  );
  const top = (minutes: number) => ((minutes - layout.startHour * 60) / 60) * HOUR;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNow =
    day === today && nowMinutes >= layout.startHour * 60 && nowMinutes <= layout.endHour * 60;
  const date = parseLocalDate(day);
  const count = layout.items.length + layout.untimed.length;

  return (
    <section aria-label={TIMELINE_TEXTS.region} className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-4">
        <div className="inline-flex items-center gap-2 rounded-xl border border-line px-3 py-1.5 text-sm font-semibold text-ink">
          <svg
            className="size-4"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3 3v10M7 5v6M11 4v8M14 6v4" />
          </svg>
          {TIMELINE_TEXTS.tab}
        </div>
      </div>
      <div className="flex items-baseline justify-between px-4 pt-4 pb-3">
        <h2 className="font-display text-base font-bold text-ink first-letter:uppercase">
          {day === today ? `${TIMELINE_TEXTS.today} · ` : ''}
          {date ? dayFormat.format(date) : day}
        </h2>
        <span className="text-xs text-ink-muted">{TIMELINE_TEXTS.count(count)}</span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-4 [scrollbar-width:thin]">
        <div className="relative" style={{ height: (layout.endHour - layout.startHour) * HOUR }}>
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute right-0 left-0 flex items-start gap-2"
              style={{ top: (hour - layout.startHour) * HOUR }}
            >
              <span className="-mt-2 w-11 shrink-0 text-[11px] text-ink-faint tabular-nums">
                {pad(hour)}:00
              </span>
              <span className="mt-0 h-px flex-1 bg-line" aria-hidden="true" />
            </div>
          ))}

          <ol className="absolute top-0 right-0 bottom-0 left-12">
            {layout.items.map(({ task, start, lane, lanes }) => {
              const list = task.list_id ? byId.get(task.list_id) : undefined;
              const done = task.completed_at !== null;
              return (
                <li
                  key={task.id}
                  className="absolute px-0.5"
                  style={{
                    top: top(start) + 2,
                    height: (SLOT_MINUTES / 60) * HOUR - 4,
                    left: `${String((lane / lanes) * 100)}%`,
                    width: `${String(100 / lanes)}%`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onOpen(task.id);
                    }}
                    className={`flex h-full w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-xs ${done ? 'opacity-60' : ''}`}
                    style={{
                      backgroundColor: list ? `var(--list-${list.color}-soft)` : 'var(--subtle)',
                      color: list ? `var(--list-${list.color}-ink)` : 'var(--ink)',
                    }}
                  >
                    <span className={`truncate font-medium ${done ? 'line-through' : ''}`}>
                      {task.title}
                    </span>
                    <span className="shrink-0 opacity-75 tabular-nums">{clock(start)}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          {showNow && (
            <div
              className="pointer-events-none absolute right-0 left-0 flex items-center"
              style={{ top: top(nowMinutes) }}
            >
              <span className="-translate-y-1/2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-fg tabular-nums">
                <span className="sr-only">{TIMELINE_TEXTS.now} </span>
                {clock(nowMinutes)}
              </span>
              <span className="h-px flex-1 -translate-y-1/2 bg-accent" aria-hidden="true" />
            </div>
          )}
        </div>

        {layout.items.length === 0 && (
          <p className="mt-4 text-center text-xs text-ink-muted">{TIMELINE_TEXTS.empty}</p>
        )}
        {layout.untimed.length > 0 && (
          <div className="mt-5">
            <h3 className="mb-2 text-xs text-ink-faint">{TIMELINE_TEXTS.untimed}</h3>
            <ul className="flex flex-col gap-1.5">
              {layout.untimed.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onOpen(task.id);
                    }}
                    className={`w-full truncate rounded-lg border border-line px-2.5 py-1.5 text-left text-xs text-ink hover:bg-subtle ${task.completed_at ? 'line-through opacity-60' : ''}`}
                  >
                    {task.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
