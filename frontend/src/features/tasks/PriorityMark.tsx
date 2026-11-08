import { PRIORITY_LABELS } from '../../constants/texts';

const PRIORITY_TONE: Readonly<Record<number, string>> = {
  1: 'text-ink-faint',
  2: 'text-warning',
  3: 'text-accent-ink',
};

/**
 * Priority as a hand-drawn exclamation mark: one, two or three strokes for
 * low, medium and high. The label is for screen readers.
 */
export function PriorityMark({ priority }: { priority: number }) {
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
