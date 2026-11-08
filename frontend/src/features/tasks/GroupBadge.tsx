import type { TaskListRead } from '../../api/schema';

/** The rounded square before a group title: the list's folder, or a calendar. */
export function GroupBadge({ list }: { list: TaskListRead | null | undefined }) {
  const color = list?.color;
  return (
    <span
      aria-hidden="true"
      className="flex size-7 items-center justify-center rounded-lg border border-line text-ink-muted"
      style={
        color ? { borderColor: `var(--list-${color})`, color: `var(--list-${color})` } : undefined
      }
    >
      <svg
        className="size-4"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        {list === undefined ? (
          <path d="M4 5.5h12v10.5H4zM4 8.5h12M7 3.5v3M13 3.5v3" strokeLinecap="round" />
        ) : (
          <path
            d="M2.5 5.5A1.5 1.5 0 0 1 4 4h3.6a1.5 1.5 0 0 1 1.1.48L9.9 5.8H16a1.5 1.5 0 0 1 1.5 1.5v7.2A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5Z"
            fill="currentColor"
            stroke="none"
          />
        )}
      </svg>
    </span>
  );
}
