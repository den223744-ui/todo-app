import type { SmartList } from '../../domain/smartLists';

const PATHS: Record<SmartList, string> = {
  // tray
  inbox:
    'M3 11.5V15a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 17 15v-3.5M3 11.5 5 4.5h10l2 7M3 11.5h4l1 2h4l1-2h4',
  // sun
  today:
    'M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM10 2.5v1.5M10 16v1.5M2.5 10H4M16 10h1.5M4.7 4.7l1 1M14.3 14.3l1 1M4.7 15.3l1-1M14.3 5.7l1-1',
  // calendar
  upcoming: 'M4 5.5h12v10.5H4zM4 8.5h12M7 3.5v3M13 3.5v3',
  // clock with alert
  overdue: 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM10 6.5V10l2.5 1.5',
  // check in circle
  completed: 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7 10.2l2 2 4-4.2',
};

export function SmartListIcon({ list }: { list: SmartList }) {
  return (
    <svg
      className="size-4 shrink-0"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[list]} />
    </svg>
  );
}
