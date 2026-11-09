import { describe, expect, it } from 'vitest';

import { makeTask } from '../test/makeTask';

import { selectSubtasks, subtaskProgress } from './subtasks';

describe('inline subtasks', () => {
  it('selects direct children in manual order without mutating the input', () => {
    const first = makeTask({ id: 'first', parent_id: 'p', position: 1 });
    const last = makeTask({ id: 'last', parent_id: 'p', position: 2 });
    const tasks = [
      last,
      makeTask({ id: 'other', parent_id: 'else' }),
      first,
      makeTask({ id: 'p' }),
    ];
    expect(selectSubtasks(tasks, 'p')).toEqual([first, last]);
    expect(tasks[0]).toBe(last);
    expect(selectSubtasks(tasks, 'missing')).toEqual([]);
  });
  it('counts open, completed and unsaved subtasks, including the empty case', () => {
    expect(subtaskProgress([])).toEqual({ done: 0, total: 0 });
    expect(
      subtaskProgress([
        makeTask({ id: 'a' }),
        makeTask({ id: 'b', completed_at: '2026-11-09T12:00:00Z' }),
        makeTask({ id: 'optimistic-1' }),
      ]),
    ).toEqual({ done: 1, total: 3 });
  });
});
