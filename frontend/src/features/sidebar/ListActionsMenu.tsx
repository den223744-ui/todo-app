import { useEffect, useRef } from 'react';

import type { TaskListRead } from '../../api/schema';
import { LIST_ACTION_TEXTS } from '../../constants/texts';
import { nextMenuIndex } from '../../domain/menuNavigation';
import { LIST_COLORS } from '../lists/listMutations';

const ITEMS = '[role="menuitem"], [role="menuitemradio"]';

interface ListActionsMenuProps {
  id: string;
  list: TaskListRead;
  busy: boolean;
  /** Opened with ArrowUp: focus starts on the last item. */
  focusLast: boolean;
  onRename: () => void;
  onColor: (color: TaskListRead['color']) => void;
  onDelete: () => void;
  /** Close and return focus to the trigger (Escape, a colour picked). */
  onClose: () => void;
  /** Focus left the menu: close without moving focus. */
  onDismiss: () => void;
}

/** The «⋯» menu of a user list: rename, colour, delete. */
export function ListActionsMenu({
  id,
  list,
  busy,
  focusLast,
  onRename,
  onColor,
  onDelete,
  onClose,
  onDismiss,
}: ListActionsMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const items = ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    (focusLast ? items?.item(items.length - 1) : items?.item(0))?.focus();
    // Only on opening: the menu mounts each time it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      role="menu"
      aria-label={LIST_ACTION_TEXTS.actions(list.name)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onDismiss();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          onClose();
          return;
        }
        const items = [...event.currentTarget.querySelectorAll<HTMLElement>(ITEMS)];
        const current = items.findIndex((item) => item === document.activeElement);
        const next = nextMenuIndex(event.key, current, items.length);
        if (next === null) return;
        event.preventDefault();
        items[next]?.focus();
      }}
      className="relative z-10 mb-2 rounded-xl border border-line bg-surface p-1 shadow-soft"
    >
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={onRename}
        className="min-h-11 w-full rounded-lg px-3 text-left text-sm text-ink-muted hover:bg-subtle"
      >
        {LIST_ACTION_TEXTS.rename}
      </button>
      <div role="group" aria-label={LIST_ACTION_TEXTS.color}>
        <p className="px-3 pt-1 text-xs text-ink-faint">{LIST_ACTION_TEXTS.color}</p>
        <div className="grid grid-cols-3">
          {LIST_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              role="menuitemradio"
              tabIndex={-1}
              aria-checked={list.color === color}
              aria-label={LIST_ACTION_TEXTS.colors[color]}
              onClick={() => {
                if (!busy) onColor(color);
              }}
              className="flex min-h-11 flex-1 items-center justify-center rounded-lg hover:bg-subtle"
            >
              <span
                className="size-5 rounded-full border-2"
                style={{
                  borderColor: `var(--list-${color})`,
                  outline: list.color === color ? '2px solid var(--ink-muted)' : undefined,
                  outlineOffset: 3,
                }}
              />
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        role="menuitem"
        tabIndex={-1}
        onClick={onDelete}
        className="min-h-11 w-full rounded-lg px-3 text-left text-sm text-danger hover:bg-subtle"
      >
        {LIST_ACTION_TEXTS.delete}
      </button>
    </div>
  );
}
