import { describe, expect, it } from 'vitest';

import { canonicalTime } from './dates';

describe('canonicalTime', () => {
  it.each([
    ['09:00', '09:00:00'],
    ['18:30', '18:30:00'],
    ['09:00:00', '09:00:00'],
    ['23:59:59', '23:59:59'],
  ])('%s -> %s', (time, expected) => {
    expect(canonicalTime(time)).toBe(expected);
  });
});
