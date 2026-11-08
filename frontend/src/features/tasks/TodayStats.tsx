import type { TaskRead } from '../../api/schema';
import { STATS_TEXTS } from '../../constants/texts';
import { countLists, selectToday, selectTomorrow } from '../../domain/smartLists';
import { progressOf } from '../../domain/taskLists';

/** The day at a glance, as in the mockup: progress ring, due today, overdue, high priority. */
export function TodayStats({ tasks, now }: { tasks: readonly TaskRead[]; now: Date }) {
  const shown = selectToday(tasks, now);
  const { done, total } = progressOf(shown, tasks);
  const counts = countLists(tasks, now);
  const urgent = shown.filter((task) => task.completed_at === null && task.priority === 3).length;
  const tomorrow = selectTomorrow(tasks, now).length;
  const share = total === 0 ? 0 : done / total;
  const radius = 17;
  const circumference = 2 * Math.PI * radius;

  return (
    <section
      aria-label={STATS_TEXTS.region}
      className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-line bg-surface px-5 py-4 shadow-soft sm:flex sm:items-center sm:gap-0 sm:divide-x sm:divide-line"
    >
      <div className="col-span-2 flex items-center gap-3 sm:flex-1 sm:pr-5">
        <svg className="size-11 shrink-0 -rotate-90" viewBox="0 0 44 44" aria-hidden="true">
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="var(--accent-soft)"
            strokeWidth="5"
          />
          <circle
            cx="22"
            cy="22"
            r={radius}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - share)}
          />
        </svg>
        <div>
          <p className="text-[15px] font-semibold text-ink">{STATS_TEXTS.done(done, total)}</p>
          <p className="text-xs text-ink-muted">{STATS_TEXTS.doneHint}</p>
        </div>
      </div>
      <Stat icon={CALENDAR} value={counts.today} label={STATS_TEXTS.dueToday} />
      <Stat icon={ARROW} value={tomorrow} label={STATS_TEXTS.dueTomorrow} />
      <Stat
        icon={ALERT}
        value={counts.overdue}
        label={STATS_TEXTS.overdue}
        tone="text-accent-ink"
      />
      <Stat icon={BANG} value={urgent} label={STATS_TEXTS.highPriority} />
    </section>
  );
}

const CALENDAR = 'M4 5.5h12v10.5H4zM4 8.5h12M7 3.5v3M13 3.5v3';
const ARROW = 'M4 5.5h12v10.5H4zM4 8.5h12M7 3.5v3M13 3.5v3M8 12.3h4M10.6 10.7l1.6 1.6-1.6 1.6';
const ALERT = 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM10 6.8v3.6M10 13.2v.1';
const BANG = 'M10 3.6v8.2M10 15.6v.6';

function Stat({
  icon,
  value,
  label,
  tone = 'text-ink-muted',
}: {
  icon: string;
  value: number;
  label: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center gap-3 sm:flex-1 sm:px-5">
      <svg
        className={`size-5 shrink-0 ${tone}`}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d={icon} />
      </svg>
      <div>
        <p className="text-[15px] font-semibold text-ink tabular-nums">{value}</p>
        <p className="text-xs text-ink-muted">{label}</p>
      </div>
    </div>
  );
}
