import { describe, expect, it } from 'vitest';

import { makeTask } from '../test/makeTask';
import { matchesSearch, normalizeForSearch, searchTasks, searchWords } from './search';

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
