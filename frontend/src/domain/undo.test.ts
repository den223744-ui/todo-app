import { describe, expect, it } from 'vitest';

import { makeTask } from '../test/makeTask';

import { undoPatch } from './undo';

describe('undoPatch', () => {
  const task = makeTask({
    id: 't',
    due_date: '2026-02-03',
    due_time: '09:30:00',
    priority: 2,
    duration_minutes: 45,
    list_id: 'work',
    tags: ['дом'],
  });
  it('restores only changed properties and restores time with a cleared date', () => {
    expect(undoPatch(task, { due_date: null })).toEqual({
      due_date: '2026-02-03',
      due_time: '09:30:00',
    });
    expect(
      undoPatch(task, {
        due_time: '11:00:00',
        priority: 3,
        duration_minutes: 15,
        list_id: null,
        tags: [],
      }),
    ).toEqual({
      due_time: '09:30:00',
      priority: 2,
      duration_minutes: 45,
      list_id: 'work',
      tags: ['дом'],
    });
  });
  it('restores both completion states, null fields and excludes text and ordering', () => {
    expect(
      undoPatch(task, { completed: true, title: 'Новое', notes: 'Текст', position: 5 }),
    ).toEqual({ completed: false });
    expect(
      undoPatch(makeTask({ id: 't', completed_at: '2026-02-03T12:00:00Z' }), { completed: false }),
    ).toEqual({ completed: true });
    expect(undoPatch(makeTask({ id: 't' }), { list_id: 'work', due_date: '2026-02-03' })).toEqual({
      list_id: null,
      due_date: null,
      due_time: null,
    });
    expect(undoPatch(task, {})).toEqual({});
  });
});
