import { describe, expect, it } from 'vitest';

import { makeTask } from '../test/makeTask';
import {
  SMART_LISTS,
  belongsTo,
  compareByDue,
  compareCompleted,
  countLists,
  countTags,
  groupByDueDate,
  isOverdue,
  isSmartList,
  selectList,
  selectTag,
  selectTodayGroups,
} from './smartLists';

const NOW = new Date(2026, 10, 9, 10, 30); // Monday, 9 Nov 2026, local time
const TODAY = '2026-11-09';
const ids = (tasks: { id: string }[]) => tasks.map((task) => task.id);

const inbox = makeTask({ id: 'inbox', position: 2 });
const inboxFirst = makeTask({ id: 'inbox-first', position: 1 });
const dueToday = makeTask({ id: 'today', due_date: TODAY, position: 5 });
const dueTodayFirst = makeTask({ id: 'today-first', due_date: TODAY, position: 1 });
const overdueOld = makeTask({ id: 'overdue-old', due_date: '2026-10-01', position: 9 });
const overdue = makeTask({ id: 'overdue', due_date: '2026-11-08', due_time: '23:59' });
const tomorrow = makeTask({ id: 'tomorrow', due_date: '2026-11-10', position: 3 });
const tomorrowEarly = makeTask({ id: 'tomorrow-9', due_date: '2026-11-10', due_time: '09:00' });
const later = makeTask({ id: 'later', due_date: '2027-01-01' });
const done = makeTask({
  id: 'done',
  due_date: '2026-11-01',
  completed_at: '2026-11-02T10:00:00.000Z',
});
const doneLater = makeTask({ id: 'done-later', completed_at: '2026-11-05T10:00:00.000Z' });
const subtask = makeTask({ id: 'sub', parent_id: 'inbox', due_date: TODAY });

const ALL = [
  inbox,
  inboxFirst,
  dueToday,
  dueTodayFirst,
  overdueOld,
  overdue,
  tomorrow,
  tomorrowEarly,
  later,
  done,
  doneLater,
  subtask,
];

describe('isSmartList', () => {
  it.each(SMART_LISTS)('%s is a smart list', (list) => {
    expect(isSmartList(list)).toBe(true);
  });

  it.each(['', 'all', 'Today', 'tag'])('%j is not', (value) => {
    expect(isSmartList(value)).toBe(false);
  });
});

describe('belongsTo (SPEC table)', () => {
  it.each([
    [inbox, ['inbox']],
    [dueToday, ['today']],
    [overdue, ['today', 'overdue']],
    [tomorrow, ['upcoming']],
    [done, ['completed']],
    [doneLater, ['completed']],
  ])('%o is in %j', (task, lists) => {
    const found = SMART_LISTS.filter((list) => belongsTo(task, list, TODAY));
    expect(found).toEqual(lists);
  });

  it('overdue is by date only: a past time today is not overdue', () => {
    const earlier = makeTask({ id: 'x', due_date: TODAY, due_time: '00:01' });

    expect(isOverdue(earlier, TODAY)).toBe(false);
    expect(belongsTo(earlier, 'overdue', TODAY)).toBe(false);
  });

  it('a completed task is never overdue', () => {
    expect(isOverdue(done, TODAY)).toBe(false);
  });

  it('a task without a date is never overdue', () => {
    expect(isOverdue(inbox, TODAY)).toBe(false);
  });
});

describe('selectList', () => {
  it('inbox: undated open tasks in manual order', () => {
    expect(ids(selectList(ALL, 'inbox', NOW))).toEqual(['inbox-first', 'inbox']);
  });

  it('today: today plus overdue, in manual order', () => {
    expect(ids(selectList(ALL, 'today', NOW))).toEqual([
      'overdue',
      'today-first',
      'today',
      'overdue-old',
    ]);
  });

  it('upcoming: by date, then time (untimed last), then manual order', () => {
    expect(ids(selectList(ALL, 'upcoming', NOW))).toEqual(['tomorrow-9', 'tomorrow', 'later']);
  });

  it('overdue: oldest first', () => {
    expect(ids(selectList(ALL, 'overdue', NOW))).toEqual(['overdue-old', 'overdue']);
  });

  it('completed: most recently completed first', () => {
    expect(ids(selectList(ALL, 'completed', NOW))).toEqual(['done-later', 'done']);
  });

  it('subtasks never appear in lists', () => {
    for (const list of SMART_LISTS) {
      expect(ids(selectList(ALL, list, NOW))).not.toContain('sub');
    }
  });

  it('"today" is the local date of now', () => {
    const lateEvening = new Date(2026, 10, 9, 23, 59);
    const nextMorning = new Date(2026, 10, 10, 0, 1);

    expect(ids(selectList([dueToday], 'today', lateEvening))).toEqual(['today']);
    expect(ids(selectList([dueToday], 'overdue', nextMorning))).toEqual(['today']);
  });
});

describe('selectTodayGroups', () => {
  it('overdue on top (oldest first), then today in manual order', () => {
    const groups = selectTodayGroups(ALL, NOW);

    expect(ids(groups.overdue)).toEqual(['overdue-old', 'overdue']);
    expect(ids(groups.today)).toEqual(['today-first', 'today']);
  });

  it('completed and subtasks stay out', () => {
    const doneToday = makeTask({ id: 'd', due_date: TODAY, completed_at: '2026-11-09T09:00:00Z' });
    const groups = selectTodayGroups([doneToday, subtask], NOW);

    expect(groups).toEqual({ overdue: [], today: [] });
  });
});

describe('groupByDueDate', () => {
  it('groups by day in date order, time order inside', () => {
    const groups = groupByDueDate([later, tomorrow, tomorrowEarly]);

    expect(groups.map((g) => [g.date, ids(g.tasks)])).toEqual([
      ['2026-11-10', ['tomorrow-9', 'tomorrow']],
      ['2027-01-01', ['later']],
    ]);
  });

  it('puts undated tasks in a group with an empty date first', () => {
    expect(groupByDueDate([tomorrow, inbox]).map((g) => g.date)).toEqual(['', '2026-11-10']);
  });

  it('handles an empty list', () => {
    expect(groupByDueDate([])).toEqual([]);
  });
});

describe('comparators', () => {
  it('compareByDue puts undated before dated and untimed after timed', () => {
    expect(compareByDue(inbox, tomorrow)).toBeLessThan(0);
    expect(compareByDue(tomorrow, tomorrowEarly)).toBeGreaterThan(0);
    expect(compareByDue(inbox, inboxFirst)).toBeGreaterThan(0); // falls back to position
  });

  it('compareCompleted puts open tasks after completed ones', () => {
    expect(compareCompleted(done, inbox)).toBeLessThan(0);
    expect(compareCompleted(inboxFirst, inbox)).toBeLessThan(0); // falls back to position
  });
});

describe('time formats', () => {
  it('equal times sort by position whether written as HH:MM or HH:MM:SS', () => {
    // Optimistic task from quick add ('09:00') vs. the server's answer ('09:00:00').
    const optimistic = makeTask({
      id: 'new',
      due_date: '2026-11-10',
      due_time: '09:00',
      position: 5,
    });
    const saved = makeTask({
      id: 'old',
      due_date: '2026-11-10',
      due_time: '09:00:00',
      position: 1,
    });

    expect(ids(selectList([optimistic, saved], 'upcoming', NOW))).toEqual(['old', 'new']);
    expect(ids(selectList([saved, optimistic], 'upcoming', NOW))).toEqual(['old', 'new']);
  });
});

describe('selectTag', () => {
  const tagged = [
    makeTask({ id: 'b', tags: ['дом'], position: 2 }),
    makeTask({ id: 'a', tags: ['дом', 'работа'], position: 1 }),
    makeTask({ id: 'done', tags: ['дом'], completed_at: '2026-11-01T00:00:00Z' }),
    makeTask({ id: 'sub', tags: ['дом'], parent_id: 'a' }),
    makeTask({ id: 'other', tags: ['работа'] }),
  ];

  it('open top-level tasks with the tag, in manual order', () => {
    expect(ids(selectTag(tagged, 'дом'))).toEqual(['a', 'b']);
  });

  it('unknown tag gives nothing', () => {
    expect(selectTag(tagged, 'нет')).toEqual([]);
  });
});

describe('counts', () => {
  it('countLists counts top-level tasks per list (today includes overdue)', () => {
    expect(countLists(ALL, NOW)).toEqual({
      inbox: 2,
      today: 4,
      upcoming: 3,
      overdue: 2,
      completed: 2,
    });
  });

  it('countTags counts open top-level tasks, sorted alphabetically', () => {
    const tasks = [
      makeTask({ id: '1', tags: ['работа', 'дом'] }),
      makeTask({ id: '2', tags: ['дом'] }),
      makeTask({ id: '3', tags: ['арбуз'], completed_at: '2026-11-01T00:00:00Z' }),
      makeTask({ id: '4', tags: ['арбуз'], parent_id: '1' }),
      makeTask({ id: '5', tags: ['ёлка'] }),
    ];

    expect(countTags(tasks)).toEqual([
      { tag: 'дом', count: 2 },
      { tag: 'ёлка', count: 1 },
      { tag: 'работа', count: 1 },
    ]);
  });

  it('countTags of nothing is empty', () => {
    expect(countTags([])).toEqual([]);
  });
});
