import type { TaskRead } from '../../api/schema';
import { STATS_TEXTS } from '../../constants/texts';
import { toLocalDateString } from '../../domain/dates';
import { countLists, selectDay, selectOpenOn } from '../../domain/smartLists';
import { progressOf } from '../../domain/taskLists';

interface TodayStatsProps {
  tasks: readonly TaskRead[];
  now: Date;
  /** The day the Today screen shows ('YYYY-MM-DD'); today when omitted. */
  day?: string;
}

/** The day at a glance, in one row: progress ring, due that day, overdue, high priority. */
export function TodayStats({ tasks, now, day }: TodayStatsProps) {
  const today = toLocalDateString(now);
  const shownDay = day ?? today;
  const isToday = shownDay === today;
  const shown = selectDay(tasks, shownDay, now);
  const { done, total } = progressOf(shown, tasks);
  const counts = countLists(tasks, now);
  // Today counts overdue tasks too (they are on the Today list); another day only its own.
  const dueThatDay = isToday ? counts.today : selectOpenOn(tasks, shownDay).length;
  const urgent = shown.filter((task) => task.completed_at === null && task.priority === 3).length;
  const share = total === 0 ? 0 : done / total;
  const radius = 17;
  const circumference = 2 * Math.PI * radius;

  return (
    <section
      aria-label={STATS_TEXTS.region}
      className="@container mt-6 rounded-2xl border border-line bg-transparent"
    >
      {/* Laid out by the card's own width: a grid when narrow, one row with dividers when wide. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 @xl:flex @xl:items-center @xl:gap-0 @xl:divide-x @xl:divide-line">
        <div className="col-span-2 flex items-center gap-3 @xl:flex-1 @xl:pr-4">
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
            <p className="text-xs whitespace-nowrap text-ink-muted">{STATS_TEXTS.doneHint}</p>
          </div>
        </div>
        <Stat
          icon={CALENDAR}
          value={dueThatDay}
          label={isToday ? STATS_TEXTS.dueToday : STATS_TEXTS.dueThatDay}
        />
        <Stat
          icon={ALERT}
          value={counts.overdue}
          label={STATS_TEXTS.overdue}
          tone="text-accent-ink"
        />
        <Stat icon={BANG} value={urgent} label={STATS_TEXTS.highPriority} />
      </div>
    </section>
  );
}

const CALENDAR = 'M4 5.5h12v10.5H4zM4 8.5h12M7 3.5v3M13 3.5v3';
const ALERT = 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM10 6.8v3.6M10 13.2v.1';
const BANG = 'M10 3.2v9M10 16v.4';

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
    <div className="flex min-w-0 items-center gap-3 @xl:flex-1 @xl:px-4">
      <svg
        className={`size-7 shrink-0 ${tone}`}
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d={icon} />
      </svg>
      <div>
        <p className="text-[15px] font-semibold text-ink tabular-nums">{value}</p>
        <p className="text-xs whitespace-nowrap text-ink-muted">{label}</p>
      </div>
    </div>
  );
}
