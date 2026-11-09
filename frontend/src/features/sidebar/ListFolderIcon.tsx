import type { TaskListRead } from '../../api/schema';

/** A small folder filled with the list's colour (the theme maps the name). */
export function ListFolderIcon({ color }: { color: TaskListRead['color'] }) {
  return (
    <svg
      className="size-5 shrink-0"
      viewBox="0 0 20 20"
      aria-hidden="true"
      style={{ color: `var(--list-${color})` }}
    >
      <path
        fill="currentColor"
        d="M2.5 5.5A1.5 1.5 0 0 1 4 4h3.6a1.5 1.5 0 0 1 1.1.48L9.9 5.8H16a1.5 1.5 0 0 1 1.5 1.5v7.2A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5Z"
      />
    </svg>
  );
}
