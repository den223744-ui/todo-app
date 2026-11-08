import { describe, expect, it } from 'vitest';

import {
  applyUpdate,
  buildOptimisticTask,
  compareByPosition,
  insertTasks,
  nextPosition,
  removeTaskWithSubtasks,
  removeTasks,
  replaceTask,
  updateTask,
} from './taskCache';
import { makeTask } from '../test/makeTask';

const NOW = new Date('2026-11-08T12:30:00.000Z');
const ids = (tasks: { id: string }[]) => tasks.map((task) => task.id);

describe('compareByPosition', () => {
  it('orders by position, then creation time, then id', () => {
    const tasks = [
      makeTask({ id: 'c', position: 2 }),
      makeTask({ id: 'b', position: 1, created_at: '2026-11-08T11:00:00.000Z' }),
      makeTask({ id: 'z', position: 1 }),
      makeTask({ id: 'a', position: 1 }),
    ];

    expect(ids([...tasks].sort(compareByPosition))).toEqual(['a', 'z', 'b', 'c']);
  });
});

describe('nextPosition', () => {
  const tasks = [
    makeTask({ id: 'p', position: 3 }),
    makeTask({ id: 'q', position: 7 }),
    makeTask({ id: 's1', parent_id: 'p', position: 2 }),
  ];

  it('appends after the last top-level task', () => {
    expect(nextPosition(tasks, null)).toBe(8);
  });

  it('appends after the last subtask of the parent', () => {
    expect(nextPosition(tasks, 'p')).toBe(3);
  });

  it('starts at 1 in an empty list', () => {
    expect(nextPosition(tasks, 'q')).toBe(1);
    expect(nextPosition([], null)).toBe(1);
  });
});

describe('buildOptimisticTask', () => {
  it('fills defaults like the server', () => {
    const task = buildOptimisticTask({ title: '  Купить молоко ' }, 'tmp', [], NOW);

    expect(task).toEqual({
      id: 'tmp',
      parent_id: null,
      title: 'Купить молоко',
      notes: null,
      priority: 0,
      due_date: null,
      due_time: null,
      tags: [],
      position: 1,
      completed_at: null,
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
    });
  });

  it('keeps given fields and normalizes tags', () => {
    const parent = makeTask({ id: 'p' });
    const task = buildOptimisticTask(
      {
        title: 'sub',
        notes: 'n',
        priority: 2,
        due_date: '2026-11-09',
        due_time: '18:00',
        tags: ['#Дом', 'дом'],
        parent_id: 'p',
        position: 5.5,
      },
      'tmp',
      [parent],
      NOW,
    );

    expect(task).toMatchObject({
      parent_id: 'p',
      notes: 'n',
      priority: 2,
      due_date: '2026-11-09',
      due_time: '18:00',
      tags: ['дом'],
      position: 5.5,
    });
  });

  it('appends to the parent list when no position is given', () => {
    const tasks = [makeTask({ id: 'p' }), makeTask({ id: 's', parent_id: 'p', position: 4 })];

    expect(buildOptimisticTask({ title: 'x', parent_id: 'p' }, 'tmp', tasks, NOW).position).toBe(5);
  });
});

describe('list operations', () => {
  const a = makeTask({ id: 'a', position: 1 });
  const b = makeTask({ id: 'b', position: 2 });

  it('insertTasks keeps order and skips tasks already present', () => {
    const c = makeTask({ id: 'c', position: 1.5 });

    expect(ids(insertTasks([a, b], [c, a]))).toEqual(['a', 'c', 'b']);
  });

  it('replaceTask swaps the task and re-sorts', () => {
    const moved = makeTask({ id: 'x', position: 3 });

    expect(ids(replaceTask([a, b], 'a', moved))).toEqual(['b', 'x']);
  });

  it('removeTasks drops the given ids', () => {
    expect(ids(removeTasks([a, b], new Set(['a', 'missing'])))).toEqual(['b']);
  });

  it('removeTaskWithSubtasks removes the parent with its subtasks', () => {
    const sub = makeTask({ id: 's', parent_id: 'a' });
    const other = makeTask({ id: 'o', parent_id: 'b' });

    const result = removeTaskWithSubtasks([a, b, sub, other], 'a');

    expect(ids(result.tasks)).toEqual(['b', 'o']);
    expect(ids(result.removed)).toEqual(['a', 's']);
  });

  it('removeTaskWithSubtasks of an unknown id changes nothing', () => {
    expect(removeTaskWithSubtasks([a], 'missing')).toEqual({ tasks: [a], removed: [] });
  });
});

describe('applyUpdate', () => {
  const task = makeTask({
    id: 't',
    title: 'old',
    notes: 'n',
    due_date: '2026-11-09',
    due_time: '18:00:00',
  });

  it('applies every field the server accepts', () => {
    const next = applyUpdate(
      task,
      { title: ' new ', notes: null, priority: 3, tags: ['#A', 'a'], position: 9 },
      NOW,
    );

    expect(next).toMatchObject({
      title: 'new',
      notes: null,
      priority: 3,
      tags: ['a'],
      position: 9,
      updated_at: NOW.toISOString(),
    });
    expect(next.created_at).toBe(task.created_at);
  });

  it('clearing the date clears the time', () => {
    expect(applyUpdate(task, { due_date: null }, NOW)).toMatchObject({
      due_date: null,
      due_time: null,
    });
  });

  it('a new date keeps the time; explicit time wins', () => {
    expect(applyUpdate(task, { due_date: '2026-12-01' }, NOW).due_time).toBe('18:00:00');
    expect(applyUpdate(task, { due_date: null, due_time: '09:00' }, NOW).due_time).toBe('09:00');
    expect(applyUpdate(task, { due_time: null }, NOW).due_date).toBe('2026-11-09');
  });

  it('completes, keeps the first completion time, reopens', () => {
    const done = applyUpdate(task, { completed: true }, NOW);
    expect(done.completed_at).toBe(NOW.toISOString());

    const again = applyUpdate(done, { completed: true }, new Date('2026-11-09T00:00:00Z'));
    expect(again.completed_at).toBe(NOW.toISOString());

    expect(applyUpdate(done, { completed: false }, NOW).completed_at).toBeNull();
  });

  it('an empty patch changes nothing, not even updated_at', () => {
    expect(applyUpdate(task, {}, NOW)).toEqual(task);
  });

  it('does not mutate the input', () => {
    const copy = structuredClone(task);
    applyUpdate(task, { title: 'x', completed: true }, NOW);
    expect(task).toEqual(copy);
  });
});

describe('updateTask', () => {
  it('updates the task in the list', () => {
    const tasks = [makeTask({ id: 'a' }), makeTask({ id: 'b', position: 2 })];

    expect(updateTask(tasks, 'b', { title: 'B' }, NOW)[1]?.title).toBe('B');
  });

  it('leaves the list alone for an unknown id', () => {
    const tasks = [makeTask({ id: 'a' })];

    expect(updateTask(tasks, 'missing', { title: 'x' }, NOW)).toEqual(tasks);
  });
});
