import { describe, expect, it } from 'vitest';

import { makeTask } from '../test/makeTask';

import { isDayClosed } from './dayClosed';
import { DEFAULT_LOCATION } from './view';

const now = new Date(2026, 10, 9, 12);
const done = makeTask({ id: 'done', due_date: '2026-11-09', completed_at: now.toISOString() });

describe('isDayClosed', () => {
  it('celebrates completed Today with implicit, null or explicit today, without mutating tasks', () => {
    const tasks = Object.freeze([Object.freeze(done)]);
    expect(isDayClosed(tasks, { view: DEFAULT_LOCATION.view, query: '', taskId: null }, now)).toBe(
      true,
    );
    expect(isDayClosed(tasks, DEFAULT_LOCATION, now)).toBe(true);
    expect(isDayClosed(tasks, { ...DEFAULT_LOCATION, day: '2026-11-09' }, now)).toBe(true);
    expect(isDayClosed(tasks, { ...DEFAULT_LOCATION, query: '  ' }, now)).toBe(true);
  });
  it('does not celebrate an empty day, old completions or tomorrow alone', () => {
    expect(isDayClosed([], DEFAULT_LOCATION, now)).toBe(false);
    expect(
      isDayClosed(
        [makeTask({ ...done, completed_at: new Date(2026, 10, 8, 12).toISOString() })],
        DEFAULT_LOCATION,
        now,
      ),
    ).toBe(false);
    expect(
      isDayClosed([makeTask({ id: 'future', due_date: '2026-11-10' })], DEFAULT_LOCATION, now),
    ).toBe(false);
  });
  it('rejects open today or overdue, but ignores undated and future tasks', () => {
    for (const due_date of ['2026-11-09', '2026-11-08']) {
      expect(isDayClosed([done, makeTask({ id: 'open', due_date })], DEFAULT_LOCATION, now)).toBe(
        false,
      );
    }
    expect(
      isDayClosed(
        [done, makeTask({ id: 'undated' }), makeTask({ id: 'future', due_date: '2026-11-10' })],
        DEFAULT_LOCATION,
        now,
      ),
    ).toBe(true);
  });
  it('includes subtasks in the same progress as the day ring', () => {
    const child = makeTask({ id: 'child', parent_id: done.id });
    expect(isDayClosed([done, child], DEFAULT_LOCATION, now)).toBe(false);
    expect(
      isDayClosed([done, { ...child, completed_at: now.toISOString() }], DEFAULT_LOCATION, now),
    ).toBe(true);
    expect(isDayClosed([child], DEFAULT_LOCATION, now)).toBe(false);
  });
  it('accepts an overdue task completed today, as the Today list does', () => {
    expect(isDayClosed([{ ...done, due_date: '2026-11-08' }], DEFAULT_LOCATION, now)).toBe(true);
  });
  it('never celebrates another day, list, tag, custom list or global search', () => {
    for (const location of [
      { ...DEFAULT_LOCATION, day: '2026-11-10' },
      { ...DEFAULT_LOCATION, query: 'done' },
      { ...DEFAULT_LOCATION, view: { kind: 'list', list: 'completed' } } as const,
      { ...DEFAULT_LOCATION, view: { kind: 'tag', tag: 'дом' } } as const,
      { ...DEFAULT_LOCATION, view: { kind: 'taskList', listId: 'work' } } as const,
    ])
      expect(isDayClosed([done], location, now)).toBe(false);
  });
});
