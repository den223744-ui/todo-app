import { useEffect, useId, useRef, useState } from 'react';

import type { TaskListRead, TaskListUpdate } from '../../api/schema';
import { LIST_ACTION_TEXTS, TEXTS } from '../../constants/texts';
import { LIST_COLORS } from '../lists/listMutations';
import { DeleteListDialog } from './DeleteListDialog';
import { ListFolderIcon } from './ListFolderIcon';
import { SidebarLink } from './SidebarLink';

interface SidebarListItemProps {
  list: TaskListRead;
  href: string;
  active: boolean;
  count: number | undefined;
  busy: boolean;
  onNavigate: () => void;
  onUpdate: ((patch: TaskListUpdate) => void) | undefined;
  onDelete: (() => void) | undefined;
}

export function SidebarListItem({
  list,
  href,
  active,
  count,
  busy,
  onNavigate,
  onUpdate,
  onDelete,
}: SidebarListItemProps) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState(list.name);
  const rootRef = useRef<HTMLLIElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastOnOpen = useRef(false);
  const menuId = useId();
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    (lastOnOpen.current ? items?.item(items.length - 1) : items?.item(0))?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);
  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  return (
    <li ref={rootRef} className="list-row relative">
      <div className="flex items-center">
        <div className="min-w-0 flex-1">
          {renaming ? (
            <input
              ref={inputRef}
              type="text"
              value={name}
              maxLength={100}
              aria-label={TEXTS.newListName}
              onChange={(event) => {
                setName(event.currentTarget.value);
              }}
              onBlur={() => {
                setRenaming(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  setRenaming(false);
                  triggerRef.current?.focus();
                }
                if (event.key === 'Enter' && !event.nativeEvent.isComposing && name.trim()) {
                  event.preventDefault();
                  if (name.trim() !== list.name) onUpdate?.({ name: name.trim() });
                  setRenaming(false);
                  triggerRef.current?.focus();
                }
              }}
              className="min-h-11 w-full rounded-xl border border-line bg-transparent px-3 text-[15px]"
            />
          ) : (
            <SidebarLink
              href={href}
              active={active}
              onNavigate={onNavigate}
              icon={<ListFolderIcon color={list.color} />}
              label={list.name}
              count={count}
            />
          )}
        </div>
        {onUpdate && onDelete && (
          <button
            ref={triggerRef}
            type="button"
            aria-label={LIST_ACTION_TEXTS.actions(list.name)}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-controls={open ? menuId : undefined}
            aria-disabled={busy || undefined}
            onClick={() => {
              if (!busy) {
                lastOnOpen.current = false;
                setOpen(!open);
              }
            }}
            onKeyDown={(event) => {
              if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !busy) {
                event.preventDefault();
                lastOnOpen.current = event.key === 'ArrowUp';
                setOpen(true);
              }
            }}
            className="list-row-action flex size-11 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:text-ink"
          >
            <svg
              className="size-5"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M4 10h.1M10 10h.1M16 10h.1" />
            </svg>
          </button>
        )}
      </div>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={LIST_ACTION_TEXTS.actions(list.name)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              close();
            }
            if (
              ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)
            ) {
              event.preventDefault();
              const items = [
                ...event.currentTarget.querySelectorAll<HTMLElement>(
                  '[role="menuitem"], [role="menuitemradio"]',
                ),
              ];
              const index = items.findIndex((item) => item === document.activeElement);
              const next =
                event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? items.length - 1
                    : (index +
                        (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) +
                        items.length) %
                      items.length;
              items[next]?.focus();
            }
          }}
          className="relative z-10 mb-2 rounded-xl border border-line bg-surface p-1 shadow-soft"
        >
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              setName(list.name);
              setRenaming(true);
              setOpen(false);
            }}
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
                    if (!busy) {
                      onUpdate?.({ color });
                      close();
                    }
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
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
            className="min-h-11 w-full rounded-lg px-3 text-left text-sm text-danger hover:bg-subtle"
          >
            {LIST_ACTION_TEXTS.delete}
          </button>
        </div>
      )}
      {confirming && (
        <DeleteListDialog
          name={list.name}
          onCancel={() => {
            setConfirming(false);
            triggerRef.current?.focus();
          }}
          onConfirm={() => {
            setConfirming(false);
            onDelete?.();
            requestAnimationFrame(() => {
              document.querySelector<HTMLElement>('[data-quick-add-input]')?.focus();
            });
          }}
        />
      )}
    </li>
  );
}
