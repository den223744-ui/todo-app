import type { TaskListRead } from '../../api/schema';
import { TEXTS } from '../../constants/texts';
import { OPTIMISTIC_ID_PREFIX } from '../tasks/taskMutations';

interface ListPickerProps {
  lists: readonly TaskListRead[];
  /** '' = no list chosen here (the open list, if any, still applies). */
  value: string;
  onChange: (listId: string) => void;
}

/**
 * A folder button at the edge of quick add: picks the list for the next task.
 * A native select under an outline folder, so keyboard and screen readers get
 * the platform's own picker.
 */
export function ListPicker({ lists, value, onChange }: ListPickerProps) {
  const chosen = lists.find((list) => list.id === value);
  return (
    <label
      className="relative flex min-h-12 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-transparent bg-transparent px-3 text-sm text-ink-muted focus-within:border-check focus-within:ring-2 focus-within:ring-check/25 hover:text-ink"
      style={chosen ? { color: `var(--list-${chosen.color}-ink)` } : undefined}
    >
      <svg
        className="size-[22px] shrink-0"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path
          d="M2.8 5.6A1.6 1.6 0 0 1 4.4 4h3.3a1.6 1.6 0 0 1 1.2.52L10 5.8h5.6a1.6 1.6 0 0 1 1.6 1.6v7A1.6 1.6 0 0 1 15.6 16H4.4a1.6 1.6 0 0 1-1.6-1.6Z"
          fill={chosen ? 'currentColor' : 'none'}
          fillOpacity={chosen ? 0.18 : 0}
        />
      </svg>
      {chosen && <span className="hidden max-w-28 truncate sm:inline">{chosen.name}</span>}
      <select
        value={value}
        aria-label={TEXTS.quickAddList}
        onChange={(event) => {
          onChange(event.currentTarget.value);
        }}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        <option value="">{TEXTS.quickAddNoList}</option>
        {lists.map((list) => (
          <option key={list.id} value={list.id} disabled={list.id.startsWith(OPTIMISTIC_ID_PREFIX)}>
            {list.name}
          </option>
        ))}
      </select>
    </label>
  );
}
