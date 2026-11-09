import { describe, expect, it } from 'vitest';

import { makeTask } from '../test/makeTask';

import {
  matchesSearch,
  normalizeForSearch,
  searchTasks,
  searchTopLevelTasks,
  searchWords,
} from './search';

const milk = makeTask({
  id: 'milk',
  title: 'Купить молоко',
  notes: 'Обезжиренное, 2 литра',
  tags: ['дом'],
});
const tree = makeTask({ id: 'tree', title: 'Нарядить ЁЛКУ', tags: [] });

describe('normalization', () => {
  it('lowercases and treats ё as е', () => {
    expect(normalizeForSearch('Ёлка ЁЖ')).toBe('елка еж');
  });

  it('splits the query into words', () => {
    expect(searchWords('  купить   Молоко ')).toEqual(['купить', 'молоко']);
    expect(searchWords('   ')).toEqual([]);
  });
});

describe('matchesSearch', () => {
  it.each(['', '  '])('empty query %j matches everything', (query) => {
    expect(matchesSearch(milk, query)).toBe(true);
  });

  it.each([
    ['молоко', true],
    ['КУПИТЬ', true],
    ['моло', true],
    ['литра', true],
    ['#дом', true],
    ['дом', true],
    ['молоко купить', true],
    ['молоко хлеб', false],
    ['работа', false],
  ])('%j -> %s', (query, expected) => {
    expect(matchesSearch(milk, query)).toBe(expected);
  });

  it('ё in the task or the query does not matter', () => {
    expect(matchesSearch(tree, 'елку')).toBe(true);
    expect(matchesSearch(tree, 'ёлку')).toBe(true);
  });

  it('works without notes', () => {
    expect(matchesSearch(tree, 'нарядить')).toBe(true);
  });
});

describe('searchTasks', () => {
  it('filters the list', () => {
    expect(searchTasks([milk, tree], 'ёлку').map((t) => t.id)).toEqual(['tree']);
    expect(searchTasks([milk, tree], '')).toHaveLength(2);
  });
});

describe('searchTopLevelTasks', () => {
  it('returns matching parents once, including matches in child notes and tags; ignores orphans', () => {
    const parent = makeTask({ id: 'p', title: 'Проект' });
    const completed = makeTask({ id: 'done', completed_at: '2026-11-08T12:00:00Z' });
    const tasks = [
      parent,
      completed,
      makeTask({ id: 'c1', parent_id: 'p', notes: 'Ёлка' }),
      makeTask({ id: 'c2', parent_id: 'p', tags: ['ёлка'] }),
      makeTask({ id: 'c3', parent_id: 'done', title: 'Ёлка' }),
      makeTask({ id: 'orphan', parent_id: 'gone', title: 'Ёлка' }),
      makeTask({ id: 'other' }),
    ];
    expect(searchTopLevelTasks(tasks, 'елка').map((task) => task.id)).toEqual(['done', 'p']);
    expect(searchTopLevelTasks(tasks, 'проект')).toEqual([parent]);
    expect(searchTopLevelTasks(tasks, 'нет')).toEqual([]);
    expect(tasks[0]).toBe(parent);
  });

  it('orders dated results by date/time, then undated, using position as the tie breaker', () => {
    const tasks = [
      makeTask({ id: 'undated-b', position: 2 }),
      makeTask({ id: 'future', due_date: '2026-11-13' }),
      makeTask({ id: 'untimed', due_date: '2026-11-09' }),
      makeTask({ id: 'timed-b', due_date: '2026-11-09', due_time: '09:00', position: 2 }),
      makeTask({ id: 'late', due_date: '2026-11-08' }),
      makeTask({ id: 'timed-a', due_date: '2026-11-09', due_time: '09:00:00', position: 1 }),
      makeTask({ id: 'undated-a', position: 1 }),
    ];
    const original = [...tasks];
    expect(searchTopLevelTasks(tasks, '').map((task) => task.id)).toEqual([
      'late',
      'timed-a',
      'timed-b',
      'untimed',
      'future',
      'undated-a',
      'undated-b',
    ]);
    expect(tasks).toEqual(original);
  });
});
