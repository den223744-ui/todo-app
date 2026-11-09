import { describe, expect, it } from 'vitest';

import { makeList } from '../test/makeList';
import { makeTask } from '../test/makeTask';

import { selectTaskGroups } from './taskGroups';
import { DEFAULT_LOCATION, type View } from './view';

const now = new Date(2026, 10, 8, 12);
const localNoon = now.toISOString();
const work = makeList({ id: 'work', name: 'Работа', position: 1 });
const home = makeList({ id: 'home', name: 'Дом', position: 2 });
const tasks = [
  makeTask({ id: 'inbox', tags: ['дом'], list_id: 'home' }),
  makeTask({ id: 'late', due_date: '2026-11-07', title: 'Молоко', list_id: 'home', position: 2 }),
  makeTask({ id: 'today', due_date: '2026-11-08', list_id: 'work' }),
  makeTask({ id: 'loose', due_date: '2026-11-08' }),
  makeTask({ id: 'done-today', due_date: '2026-11-08', completed_at: localNoon, list_id: 'home' }),
  makeTask({ id: 'future-b', due_date: '2026-11-10' }),
  makeTask({ id: 'future-a', due_date: '2026-11-09', due_time: '09:00:00' }),
  makeTask({ id: 'future-c', due_date: '2026-11-09', due_time: '18:00:00' }),
  makeTask({ id: 'done', completed_at: '2026-11-08T10:00:00Z' }),
  makeTask({ id: 'child', parent_id: 'today', due_date: '2026-11-08' }),
];
const select = (view: View, query = '') =>
  selectTaskGroups(tasks, [home, work], { ...DEFAULT_LOCATION, view, query }, now);

describe('selectTaskGroups', () => {
  it('groups today by list, loose tasks next, tomorrow last, with the completions of today', () => {
    expect(
      select({ kind: 'list', list: 'today' }).map(({ key, list, tasks: grouped }) => [
        key,
        list?.name ?? null,
        grouped.map((task) => task.id),
      ]),
    ).toEqual([
      ['list:work', 'Работа', ['today']],
      ['list:home', 'Дом', ['late', 'done-today']],
      ['list:none', null, ['loose']],
      // Tomorrow's tasks last, as one group, by time.
      ['tomorrow', null, ['future-a', 'future-c']],
    ]);
  });

  it('shows another day on the Today screen, without a tomorrow group', () => {
    expect(
      selectTaskGroups(tasks, [home, work], { ...DEFAULT_LOCATION, day: '2026-11-09' }, now).map(
        ({ key, tasks: grouped }) => [key, grouped.map((task) => task.id)],
      ),
    ).toEqual([['list:none', ['future-a', 'future-c']]]);
  });

  it('omits empty search groups', () => {
    expect(select({ kind: 'list', list: 'today' }, 'молоко').map((group) => group.key)).toEqual([
      'search:open',
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
  ] as const)('selects the %s view without a group heading', (list, id) => {
    expect(
      select({ kind: 'list', list }).map(({ key, tasks: grouped }) => [
        key,
        grouped.map((task) => task.id),
      ]),
    ).toEqual([['all', [id]]]);
  });

  it('selects the completed view without a group heading', () => {
    const [group, ...rest] = select({ kind: 'list', list: 'completed' });

    expect(rest).toEqual([]);
    expect(group?.key).toBe('all');
    expect(group?.tasks.map((task) => task.id).sort()).toEqual(['done', 'done-today']);
  });

  it('searches globally from a tag and returns no groups for an empty result', () => {
    expect(select({ kind: 'tag', tag: 'дом' })[0]?.tasks.map((task) => task.id)).toEqual(['inbox']);
    expect(select({ kind: 'tag', tag: 'дом' }, 'молоко')[0]?.tasks.map((task) => task.id)).toEqual([
      'late',
    ]);
    expect(select({ kind: 'tag', tag: 'нет' })).toEqual([]);
    expect(select({ kind: 'list', list: 'upcoming' }, 'нет')).toEqual([]);
  });

  it.each<View>([
    { kind: 'list', list: 'inbox' },
    { kind: 'list', list: 'today' },
    { kind: 'list', list: 'upcoming' },
    { kind: 'list', list: 'overdue' },
    { kind: 'list', list: 'completed' },
    { kind: 'taskList', listId: 'work' },
    { kind: 'tag', tag: 'дом' },
  ])('returns the same open and completed search groups for %j', (view) => {
    const matches = [
      makeTask({ id: 'done-b', title: 'Отчёт', completed_at: localNoon }),
      makeTask({ id: 'future', title: 'Отчёт', due_date: '2026-11-13' }),
      makeTask({ id: 'late', title: 'Отчёт', due_date: '2026-11-07' }),
      makeTask({ id: 'done-a', title: 'Отчёт', due_date: '2026-11-07', completed_at: localNoon }),
      makeTask({ id: 'undated', title: 'Отчёт' }),
    ];
    expect(
      selectTaskGroups(
        matches,
        [],
        { ...DEFAULT_LOCATION, view, query: 'отчёт', day: '2027-01-01' },
        now,
      ).map(({ key, tasks: grouped }) => [key, grouped.map((task) => task.id)]),
    ).toEqual([
      ['search:open', ['late', 'future', 'undated']],
      ['search:completed', ['done-a', 'done-b']],
    ]);
  });

  it('omits the open group when only completed tasks match, and treats whitespace as no search', () => {
    const done = makeTask({ id: 'done', completed_at: localNoon });
    expect(selectTaskGroups([done], [], { ...DEFAULT_LOCATION, query: 'done' }, now)).toEqual([
      { key: 'search:completed', tasks: [done] },
    ]);
    expect(select({ kind: 'list', list: 'today' }, '   ')).toEqual(
      select({ kind: 'list', list: 'today' }),
    );
  });

  it('shows the open tasks of one of the user lists', () => {
    expect(
      select({ kind: 'taskList', listId: 'home' }).map(({ key, tasks: grouped }) => [
        key,
        grouped.map((task) => task.id),
      ]),
    ).toEqual([['all', ['inbox', 'late']]]);
    expect(select({ kind: 'taskList', listId: 'gone' })).toEqual([]);
  });
});
