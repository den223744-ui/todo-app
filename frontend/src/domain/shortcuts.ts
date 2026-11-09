export interface ShortcutEvent {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  isComposing: boolean;
}
export interface ShortcutContext {
  editable: boolean;
  blocked: boolean;
  paletteOpen: boolean;
  ownsArrows: boolean;
}
export type Shortcut =
  | 'palette'
  | 'help'
  | 'new'
  | 'search'
  | 'next'
  | 'previous'
  | 'toggle'
  | 'edit'
  | 'open'
  | 'delete'
  | 'clear'
  | 'move-up'
  | 'move-down';

export function resolveShortcut(event: ShortcutEvent, context: ShortcutContext): Shortcut | null {
  if (event.isComposing) return null;
  if (
    (event.ctrlKey || event.metaKey) &&
    !event.altKey &&
    !event.shiftKey &&
    event.code === 'KeyK'
  ) {
    return context.blocked && !context.paletteOpen ? null : 'palette';
  }
  if (context.blocked || context.paletteOpen || context.editable || event.ctrlKey || event.metaKey)
    return null;
  if (event.altKey) {
    if (event.shiftKey || context.ownsArrows) return null;
    if (event.key === 'ArrowUp') return 'move-up';
    if (event.key === 'ArrowDown') return 'move-down';
    return null;
  }
  if (event.key === '?' || (event.code === 'Slash' && event.shiftKey)) return 'help';
  if (event.shiftKey) return null;
  if (event.key === '/' || event.code === 'Slash') return 'search';
  if (event.code === 'KeyN') return 'new';
  if (event.code === 'KeyJ' || (!context.ownsArrows && event.key === 'ArrowDown')) return 'next';
  if (event.code === 'KeyK' || (!context.ownsArrows && event.key === 'ArrowUp')) return 'previous';
  if (event.code === 'KeyX') return 'toggle';
  if (event.code === 'KeyE') return 'edit';
  if (event.key === 'Enter') return 'open';
  if (event.key === 'Backspace' || event.key === 'Delete') return 'delete';
  if (event.key === 'Escape') return 'clear';
  return null;
}

export function adjacentTask(
  ids: readonly string[],
  selected: string | null,
  delta: number,
): string | null {
  if (ids.length === 0) return null;
  const index = selected === null ? -1 : ids.indexOf(selected);
  return ids[index < 0 ? 0 : Math.max(0, Math.min(ids.length - 1, index + delta))] as string;
}

export function isMacPlatform(platform: string): boolean {
  return /mac|iphone|ipad/i.test(platform);
}
