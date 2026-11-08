import { describe, expect, it } from 'vitest';

import { canonicalTime, parseLocalDate, shiftDate } from './dates';

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

describe('parseLocalDate', () => {
  it('reads a real calendar day as local midnight', () => {
    expect(parseLocalDate('2026-11-09')).toEqual(new Date(2026, 10, 9));
  });

  it.each(['2026-02-30', '2026-13-01', '9-11-2026', '2026-11-9', ''])('rejects %s', (value) => {
    expect(parseLocalDate(value)).toBeNull();
  });
});

describe('shiftDate', () => {
  it('moves by days across months and years', () => {
    expect(shiftDate('2026-11-30', 1)).toBe('2026-12-01');
    expect(shiftDate('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('leaves a malformed value as it is', () => {
    expect(shiftDate('nope', 1)).toBe('nope');
  });
});
