import { describe, expect, it } from 'vitest';

import { makeTask } from '../test/makeTask';

import { SLOT_MINUTES, layoutTimeline } from './timeline';

const DAY = '2026-11-09';
const at = (id: string, time: string | null, extra = {}) =>
  makeTask({ id, due_date: DAY, due_time: time, ...extra });

describe('layoutTimeline', () => {
  it('places timed tasks of the day in time order with a fixed slot', () => {
    const layout = layoutTimeline(
      [
        at('late', '18:00:00'),
        at('early', '09:00:00'),
        at('other-day', '10:00:00', { due_date: '2026-11-10' }),
        at('sub', '11:00:00', { parent_id: 'early' }),
      ],
      DAY,
    );

    expect(
      layout.items.map((item) => [item.task.id, item.start, item.end, item.lane, item.lanes]),
    ).toEqual([
      ['early', 540, 540 + SLOT_MINUTES, 0, 1],
      ['late', 1080, 1080 + SLOT_MINUTES, 0, 1],
    ]);
    expect([layout.startHour, layout.endHour]).toEqual([8, 22]);
  });

  it('puts overlapping blocks side by side, and reuses a lane once it is free', () => {
    const layout = layoutTimeline(
      [
        at('a', '10:00:00', { position: 1 }),
        at('b', '10:00:00', { position: 2 }),
        at('c', '10:15:00'),
        at('d', '10:30:00'),
        at('e', '12:00:00'),
      ],
      DAY,
    );

    expect(layout.items.map((item) => [item.task.id, item.lane, item.lanes])).toEqual([
      ['a', 0, 3],
      ['b', 1, 3],
      ['c', 2, 3],
      ['d', 0, 3], // a and b end at 10:30: lane 0 is free again, still in the same group
      ['e', 0, 1],
    ]);
  });

  it('makes a block as long as its task, and sums the planned time of the day', () => {
    const layout = layoutTimeline(
      [
        at('long', '09:00:00', { duration_minutes: 90 }),
        at('next', '10:00:00'),
        at('later', '11:00:00', { duration_minutes: 15 }),
        at('untimed', null, { duration_minutes: 60 }),
      ],
      DAY,
    );

    expect(layout.items.map((item) => [item.task.id, item.start, item.end, item.lanes])).toEqual([
      ['long', 540, 630, 2],
      ['next', 600, 630, 2], // no duration: one slot; overlaps the long one
      ['later', 660, 675, 1],
    ]);
    expect(layout.plannedMinutes).toBe(90 + 15 + 60);
  });

  it('grows the grid for early and late tasks, never past midnight', () => {
    const layout = layoutTimeline([at('dawn', '06:30:00'), at('night', '23:45:00')], DAY);

    expect([layout.startHour, layout.endHour]).toEqual([6, 24]);
    expect(layout.items[1]?.end).toBe(24 * 60);
  });

  it('lists the day’s untimed tasks apart and handles an empty day', () => {
    const untimed = at('any', null);

    expect(layoutTimeline([untimed], DAY)).toEqual({
      startHour: 8,
      endHour: 22,
      items: [],
      untimed: [untimed],
      plannedMinutes: 0,
    });
  });
});
