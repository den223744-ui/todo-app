import type { RefObject } from 'react';

import { TEXTS } from '../../constants/texts';

interface MoveToTodayButtonProps {
  title: string;
  locked: boolean;
  selected: boolean;
  /** The row's link: focus stays on it while the row is still shown. */
  linkRef: RefObject<HTMLAnchorElement>;
  onMove: () => void;
}

/** «На сегодня» on an overdue row. */
export function MoveToTodayButton({
  title,
  locked,
  selected,
  linkRef,
  onMove,
}: MoveToTodayButtonProps) {
  return (
    <button
      type="button"
      aria-label={TEXTS.moveToTodayNamed(title)}
      aria-disabled={locked || undefined}
      onClick={(event) => {
        if (locked) return;
        const row = event.currentTarget.closest('li');
        const next =
          row?.nextElementSibling?.querySelector<HTMLElement>('[data-task-link]') ??
          row?.previousElementSibling?.querySelector<HTMLElement>('[data-task-link]');
        onMove();
        // The row may leave the view (Overdue): then focus a neighbour or quick add.
        requestAnimationFrame(() => {
          (
            (linkRef.current?.closest('[aria-hidden="true"]') ? null : linkRef.current) ??
            next ??
            document.querySelector<HTMLElement>('[data-quick-add-input]')
          )?.focus();
        });
      }}
      className={`task-row-action mr-2 min-h-11 shrink-0 rounded-lg px-2 text-xs text-ink-muted hover:text-accent-ink ${selected ? 'is-selected' : ''}`}
    >
      {TEXTS.moveToToday}
    </button>
  );
}
