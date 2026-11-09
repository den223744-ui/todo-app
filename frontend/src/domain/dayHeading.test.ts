import { describe, expect, it } from 'vitest';
import { dayHeading } from './dayHeading';

describe('dayHeading', () => {
  const now = new Date(2026, 10, 9, 23, 59);
  it('names the next two local days', () => {
    expect(dayHeading('2026-11-10', now)).toBe('Завтра');
    expect(dayHeading('2026-11-11', now)).toBe('Послезавтра');
  });
  it('uses a short weekday and date with a year only outside the current year', () => {
    expect(dayHeading('2026-11-12', now)).toBe('Чт, 12 нояб.');
    expect(dayHeading('2027-11-12', now)).toBe('Пт, 12 нояб. 2027 г.');
  });
  it('handles month/year and daylight-saving boundaries without dividing milliseconds', () => {
    expect(dayHeading('2027-01-01', new Date(2026, 11, 31, 23))).toBe('Завтра');
    expect(dayHeading('2027-01-02', new Date(2026, 11, 31, 23))).toBe('Послезавтра');
    expect(dayHeading('2026-03-30', new Date(2026, 2, 28, 12))).toBe('Послезавтра');
  });
});
