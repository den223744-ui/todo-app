import { describe, expect, it } from 'vitest';

import { nextMenuIndex } from './menuNavigation';

describe('nextMenuIndex', () => {
  it.each([
    ['ArrowDown', 0, 1],
    ['ArrowRight', 1, 2],
    ['ArrowDown', 2, 0],
    ['ArrowUp', 1, 0],
    ['ArrowLeft', 0, 2],
    ['ArrowDown', -1, 0],
    ['ArrowUp', -1, 2],
    ['Home', 2, 0],
    ['End', 0, 2],
  ])('%s from %i goes to %i in three items', (key, current, expected) => {
    expect(nextMenuIndex(key, current, 3)).toBe(expected);
  });

  it('ignores other keys and empty menus', () => {
    expect(nextMenuIndex('Enter', 0, 3)).toBeNull();
    expect(nextMenuIndex('ArrowDown', -1, 0)).toBeNull();
  });
});
