import { describe, expect, it } from 'vitest';

import {
  adjacentTask,
  isMacPlatform,
  resolveShortcut,
  type ShortcutContext,
  type ShortcutEvent,
} from './shortcuts';

const event: ShortcutEvent = {
  key: '',
  code: '',
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  isComposing: false,
};
const context: ShortcutContext = {
  editable: false,
  blocked: false,
  paletteOpen: false,
  ownsArrows: false,
};
const resolve = (patch: Partial<ShortcutEvent>, ctx: Partial<ShortcutContext> = {}) =>
  resolveShortcut({ ...event, ...patch }, { ...context, ...ctx });

describe('keyboard resolution', () => {
  it.each([
    ['KeyN', 'new'],
    ['KeyJ', 'next'],
    ['KeyK', 'previous'],
    ['KeyX', 'toggle'],
    ['KeyE', 'edit'],
  ] as const)('uses physical code %s in Russian layout', (code, action) => {
    expect(resolve({ code, key: 'т' })).toBe(action);
  });
  it.each([
    ['/', 'search'],
    ['?', 'help'],
    ['ArrowDown', 'next'],
    ['ArrowUp', 'previous'],
    ['Enter', 'open'],
    ['Backspace', 'delete'],
    ['Delete', 'delete'],
    ['Escape', 'clear'],
    ['a', null],
  ] as const)('%s', (key, action) => {
    expect(resolve({ key })).toBe(action);
  });
  it('respects composition, fields, overlays and modifiers', () => {
    for (const ctx of [{ editable: true }, { blocked: true }, { paletteOpen: true }])
      expect(resolve({ code: 'KeyN' }, ctx)).toBeNull();
    for (const patch of [
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
      { shiftKey: true },
      { isComposing: true },
    ])
      expect(resolve({ code: 'KeyN', ...patch })).toBeNull();
    expect(resolve({ code: 'Slash' })).toBe('search');
    expect(resolve({ code: 'Slash', shiftKey: true, key: ',' })).toBe('help');
    expect(resolve({ key: '?', ctrlKey: true })).toBeNull();
    for (const key of ['ArrowUp', 'ArrowDown'])
      expect(resolve({ key }, { ownsArrows: true })).toBeNull();
  });
  it('allows command K inside fields and toggles palette but respects other modals', () => {
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }])
      expect(resolve({ ...modifier, code: 'KeyK' }, { editable: true })).toBe('palette');
    expect(resolve({ ctrlKey: true, code: 'KeyK' }, { blocked: true })).toBeNull();
    expect(resolve({ ctrlKey: true, code: 'KeyK' }, { blocked: true, paletteOpen: true })).toBe(
      'palette',
    );
    expect(resolve({ ctrlKey: true, code: 'KeyK', altKey: true })).toBeNull();
    expect(resolve({ ctrlKey: true, code: 'KeyK', shiftKey: true })).toBeNull();
  });
  it('reserves exactly Alt+arrows for ordering', () => {
    expect(resolve({ altKey: true, key: 'ArrowUp' })).toBe('move-up');
    expect(resolve({ altKey: true, key: 'ArrowDown' })).toBe('move-down');
    expect(resolve({ altKey: true, key: 'ArrowUp', shiftKey: true })).toBeNull();
    expect(resolve({ altKey: true, key: 'ArrowUp' }, { ownsArrows: true })).toBeNull();
  });
  it('finds adjacent tasks without wrapping and identifies the platform', () => {
    expect(adjacentTask([], null, 1)).toBeNull();
    expect(adjacentTask(['a', 'b'], null, -1)).toBe('a');
    expect(adjacentTask(['a', 'b'], 'gone', 1)).toBe('a');
    expect(adjacentTask(['a', 'b'], 'a', -1)).toBe('a');
    expect(adjacentTask(['a', 'b'], 'b', 1)).toBe('b');
    expect(adjacentTask(['a', 'b'], 'b', -1)).toBe('a');
    expect(isMacPlatform('MacIntel')).toBe(true);
    expect(isMacPlatform('iPhone')).toBe(true);
    expect(isMacPlatform('Win32')).toBe(false);
  });
});
