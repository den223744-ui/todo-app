import { describe, expect, it } from 'vitest';

import { makeTask } from '../test/makeTask';
import { selectTaskGroups } from './taskGroups';
import { DEFAULT_LOCATION, type View } from './view';

const now = new Date(2026, 10, 8, 12);
const tasks = [
  makeTask({ id: 'inbox', tags: ['дом'] }),
  makeTask({ id: 'late', due_date: '2026-11-07', title: 'Молоко' }),
  makeTask({ id: 'today', due_date: '2026-11-08' }),
  makeTask({ id: 'future-b', due_date: '2026-11-10' }),
  makeTask({ id: 'future-a', due_date: '2026-11-09', due_time: '09:00:00' }),
  makeTask({ id: 'future-c', due_date: '2026-11-09', due_time: '18:00:00' }),
  makeTask({ id: 'done', completed_at: '2026-11-08T10:00:00Z' }),
  makeTask({ id: 'child', parent_id: 'today', due_date: '2026-11-08' }),
];
const select = (view: View, query = '') =>
  selectTaskGroups(tasks, { ...DEFAULT_LOCATION, view, query }, now);

describe('selectTaskGroups', () => {
  it('groups today with overdue first and excludes subtasks and completed tasks', () => {
    expect(
      select({ kind: 'list', list: 'today' }).map(({ key, tasks: grouped }) => [
        key,
        grouped.map((task) => task.id),
      ]),
    ).toEqual([
      ['overdue', ['late']],
      ['today', ['today']],
    ]);
  });

  it('omits empty today groups after search', () => {
    expect(select({ kind: 'list', list: 'today' }, 'молоко').map((group) => group.key)).toEqual([
      'overdue',
    ]);
    expect(select({ kind: 'list', list: 'today' }, 'ничего')).toEqual([]);
  });

  it('groups upcoming by local calendar dates and sorts days and times', () => {
    expect(
      select({ kind: 'list', list: 'upcoming' }).map(({ key, tasks: grouped }) => [
        key,
        grouped.map((task) => task.id),
      ]),
    ).toEqual([
      ['2026-11-09', ['future-a', 'future-c']],
      ['2026-11-10', ['future-b']],
    ]);
  });

  it.each([
    ['inbox', 'inbox'],
    ['overdue', 'late'],
    ['completed', 'done'],
  ] as const)('selects the %s view without a group heading', (list, id) => {
    expect(
      select({ kind: 'list', list }).map(({ key, tasks: grouped }) => [
        key,
        grouped.map((task) => task.id),
      ]),
    ).toEqual([['all', [id]]]);
  });

  it('searches within a tag and returns no groups for an empty result', () => {
    expect(select({ kind: 'tag', tag: 'дом' })[0]?.tasks.map((task) => task.id)).toEqual(['inbox']);
    expect(select({ kind: 'tag', tag: 'дом' }, 'молоко')).toEqual([]);
    expect(select({ kind: 'tag', tag: 'нет' })).toEqual([]);
    expect(select({ kind: 'list', list: 'upcoming' }, 'нет')).toEqual([]);
  });
});
