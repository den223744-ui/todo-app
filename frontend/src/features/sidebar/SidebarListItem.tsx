import { useEffect, useId, useRef, useState } from 'react';

import type { TaskListRead, TaskListUpdate } from '../../api/schema';
import { LIST_ACTION_TEXTS, TEXTS } from '../../constants/texts';

import { DeleteListDialog } from './DeleteListDialog';
import { ListActionsMenu } from './ListActionsMenu';
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
  const inputRef = useRef<HTMLInputElement>(null);
  // Opened with ArrowUp: the menu starts on its last item.
  const [focusLast, setFocusLast] = useState(false);
  const menuId = useId();
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
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
                setFocusLast(false);
                setOpen(!open);
              }
            }}
            onKeyDown={(event) => {
              if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !busy) {
                event.preventDefault();
                setFocusLast(event.key === 'ArrowUp');
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
        <ListActionsMenu
          id={menuId}
          list={list}
          busy={busy}
          focusLast={focusLast}
          onRename={() => {
            setName(list.name);
            setRenaming(true);
            setOpen(false);
          }}
          onColor={(color) => {
            onUpdate?.({ color });
            close();
          }}
          onDelete={() => {
            setOpen(false);
            setConfirming(true);
          }}
          onClose={close}
          onDismiss={() => {
            setOpen(false);
          }}
        />
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
              const target = document.querySelector<HTMLElement>('[data-sidebar-today]');
              if (target && !target.closest('[role="dialog"]')) target.focus();
            });
          }}
        />
      )}
    </li>
  );
}
