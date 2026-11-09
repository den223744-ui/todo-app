import { TEXTS } from '../../constants/texts';

interface SubtasksToggleProps {
  title: string;
  done: number;
  total: number;
  expanded: boolean;
  /** Id of the subtask list it shows and hides. */
  controls: string;
  onToggle: () => void;
}

/** The «1/3» counter that expands a task's subtasks in place. */
export function SubtasksToggle({
  title,
  done,
  total,
  expanded,
  controls,
  onToggle,
}: SubtasksToggleProps) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={expanded ? controls : undefined}
      aria-label={TEXTS.subtasksToggle(done, total, expanded, title)}
      onClick={onToggle}
      className="mr-1 flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-xs tabular-nums text-ink-muted hover:text-ink"
    >
      <span>
        {done}/{total}
      </span>
      <svg
        className="size-3.5"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={expanded ? 'm5 12 5-5 5 5' : 'm5 8 5 5 5-5'} />
      </svg>
    </button>
  );
}
