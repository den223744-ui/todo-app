import { DAY_NAV_TEXTS } from '../../constants/texts';
import { shiftDate } from '../../domain/dates';

interface DayNavProps {
  /** The day shown, 'YYYY-MM-DD'. */
  day: string;
  today: string;
  /** null = back to today (the URL then carries no day). */
  onChange: (day: string | null) => void;
}

const ARROW = 'size-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink';

/** ‹ Сегодня › next to the date: step a day back or forward, or jump back to today. */
export function DayNav({ day, today, onChange }: DayNavProps) {
  const go = (next: string) => {
    onChange(next === today ? null : next);
  };
  return (
    <div
      role="group"
      aria-label={DAY_NAV_TEXTS.group}
      className="inline-flex items-center rounded-full border border-line px-1"
    >
      <button
        type="button"
        aria-label={DAY_NAV_TEXTS.previous}
        onClick={() => {
          go(shiftDate(day, -1));
        }}
        className={ARROW}
      >
        <svg
          className="size-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10 3.5 5.5 8l4.5 4.5" />
        </svg>
      </button>
      <button
        type="button"
        aria-current={day === today ? 'date' : undefined}
        onClick={() => {
          onChange(null);
        }}
        className={`rounded-full px-2.5 py-1 text-sm ${day === today ? 'font-semibold text-ink' : 'text-ink-muted hover:text-ink'}`}
      >
        {DAY_NAV_TEXTS.today}
      </button>
      <button
        type="button"
        aria-label={DAY_NAV_TEXTS.next}
        onClick={() => {
          go(shiftDate(day, 1));
        }}
        className={ARROW}
      >
        <svg
          className="size-4"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 3.5 4.5 4.5L6 12.5" />
        </svg>
      </button>
    </div>
  );
}
