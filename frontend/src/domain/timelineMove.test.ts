import { expect, it } from 'vitest';

import {
  clampTimelineStart,
  formatTimelineTime,
  minutesOf,
  pixelsToMinutes,
  shiftedTime,
} from './timeline';

it('snaps pixel offsets symmetrically to quarter-hours', () => {
  expect(pixelsToMinutes(14, 56)).toBe(15);
  expect(pixelsToMinutes(-14, 56)).toBe(-15);
  expect(pixelsToMinutes(6, 56)).toBe(0);
  expect(pixelsToMinutes(56, 56)).toBe(60);
});
it('clamps full duration inside the day and formats canonical API times', () => {
  expect(clampTimelineStart(-15, 30)).toBe(0);
  expect(clampTimelineStart(1430, 30)).toBe(1410);
  expect(clampTimelineStart(600, 1440)).toBe(0);
  expect(formatTimelineTime(0)).toBe('00:00');
  expect(formatTimelineTime(1440)).toBe('24:00');
  expect(shiftedTime('14:15', 30, 15)).toBe('14:30:00');
  expect(shiftedTime('23:45:00', 30, 60)).toBe('23:30:00');
  expect(shiftedTime('00:15:00', 30, -60)).toBe('00:00:00');
  expect(minutesOf('')).toBe(0);
  expect(minutesOf('12')).toBe(720);
});
