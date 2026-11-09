import { describe, expect, it } from 'vitest';

import { makeList } from '../test/makeList';
import { makeTask } from '../test/makeTask';

import { compareLists, countByList, groupByList, progressOf, selectInList } from './taskLists';

const ids = (tasks: { id: string }[]) => tasks.map((task) => task.id);

const work = makeList({ id: 'work', position: 1 });
const home = makeList({ id: 'home', position: 2 });

describe('compareLists', () => {
  it('orders by position, then creation time, then id', () => {
    const lists = [
      makeList({ id: 'c', position: 2 }),
      makeList({ id: 'b', position: 1, created_at: '2026-11-08T11:00:00.000Z' }),
      makeList({ id: 'z', position: 1 }),
      makeList({ id: 'a', position: 1 }),
    ];

    expect(ids([...lists].sort(compareLists))).toEqual(['a', 'z', 'b', 'c']);
  });
});

describe('groupByList', () => {
  it('groups in list order, keeps task order, puts loose and orphaned tasks last', () => {
    const tasks = [
      makeTask({ id: 'h1', list_id: 'home' }),
      makeTask({ id: 'loose' }),
      makeTask({ id: 'w1', list_id: 'work' }),
      makeTask({ id: 'orphan', list_id: 'deleted' }),
      makeTask({ id: 'h2', list_id: 'home' }),
    ];

    const groups = groupByList(tasks, [home, work]);

    expect(groups.map((group) => [group.list?.id ?? null, ids(group.tasks)])).toEqual([
      ['work', ['w1']],
      ['home', ['h1', 'h2']],
      [null, ['loose', 'orphan']],
    ]);
  });

  it('leaves out empty groups', () => {
    expect(groupByList([makeTask({ id: 'w', list_id: 'work' })], [work, home])).toEqual([
      { list: work, tasks: [makeTask({ id: 'w', list_id: 'work' })] },
    ]);
    expect(groupByList([], [work])).toEqual([]);
  });
});

describe('selectInList', () => {
  it('open top-level tasks of the list in the manual order', () => {
    const tasks = [
      makeTask({ id: 'second', list_id: 'work', position: 2 }),
      makeTask({ id: 'first', list_id: 'work', position: 1 }),
      makeTask({ id: 'done', list_id: 'work', completed_at: '2026-11-08T10:00:00Z' }),
      makeTask({ id: 'other', list_id: 'home' }),
      makeTask({ id: 'sub', list_id: 'work', parent_id: 'first' }),
    ];

    expect(ids(selectInList(tasks, 'work'))).toEqual(['first', 'second']);
  });
});

describe('countByList', () => {
  it('counts open top-level tasks per list', () => {
    const tasks = [
      makeTask({ id: 'a', list_id: 'work' }),
      makeTask({ id: 'b', list_id: 'work' }),
      makeTask({ id: 'c', list_id: 'home' }),
      makeTask({ id: 'done', list_id: 'home', completed_at: '2026-11-08T10:00:00Z' }),
      makeTask({ id: 'sub', list_id: 'home', parent_id: 'c' }),
      makeTask({ id: 'loose' }),
    ];

    expect(countByList(tasks)).toEqual(
      new Map([
        ['work', 2],
        ['home', 1],
      ]),
    );
  });
});

describe('progressOf', () => {
  it('counts the shown tasks with their subtasks', () => {
    const parent = makeTask({ id: 'p' });
    const doneTask = makeTask({ id: 'd', completed_at: '2026-11-08T10:00:00Z' });
    const all = [
      parent,
      doneTask,
      makeTask({ id: 's1', parent_id: 'p', completed_at: '2026-11-08T10:00:00Z' }),
      makeTask({ id: 's2', parent_id: 'p' }),
      makeTask({ id: 'hidden-sub', parent_id: 'not-shown' }),
      makeTask({ id: 'not-shown' }),
    ];

    expect(progressOf([parent, doneTask], all)).toEqual({ done: 2, total: 4 });
    expect(progressOf([], all)).toEqual({ done: 0, total: 0 });
  });
});
