import { ONE_LINE } from '../../components/icons/oneLinePaths';
import type { SmartList } from '../../domain/smartLists';

/* One-line drawings (see oneLinePaths): soft, thin, no tinted fills. */
const PATHS: Record<SmartList, string> = {
  today: ONE_LINE.sun,
  inbox: ONE_LINE.inbox,
  upcoming: ONE_LINE.upcoming,
  overdue: ONE_LINE.overdue,
  completed: ONE_LINE.completed,
};

export function SmartListIcon({ list }: { list: SmartList }) {
  return (
    <svg
      className="size-[22px] shrink-0"
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
