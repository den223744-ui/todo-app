import { describe, expect, it } from 'vitest';
import { makeList } from '../test/makeList';
import { parseQuickAdd, toTaskCreate } from './quickAdd';
import { prepareQuickAdd } from './quickAddInput';

const now = new Date(2026, 10, 9, 12);
const lists = [
  makeList({ id: 'work', name: 'Работа' }),
  makeList({ id: 'personal', name: '  Личные дела  ' }),
  makeList({ id: 'tree', name: 'Ёлка' }),
];

describe('@list quick-add tokens', () => {
  it('lets an explicit folder (including no list) override the token, ignoring removed folders', () => {
    const view = { kind: 'taskList', listId: 'personal' } as const;
    expect(prepareQuickAdd('Дело @работа', view, now, null, lists, 'personal').task).toMatchObject({
      list_id: 'personal',
    });
    expect(prepareQuickAdd('Дело @работа', view, now, null, lists, null).task).toMatchObject({
      list_id: null,
    });
    expect(prepareQuickAdd('Дело @работа', view, now, null, lists, 'removed').task).toMatchObject({
      list_id: 'work',
    });
  });
  it.each([
    ['@рАБоТа', 'work'],
    ['@личные', 'personal'],
    ['@ЕЛКА', 'tree'],
  ])('recognizes %s and preserves the exact highlight range', (token, id) => {
    const input = `Дело ${token} завтра #тег !!`;
    const parsed = parseQuickAdd(input, now, lists);
    expect(parsed).toMatchObject({ title: 'Дело', listId: id, tags: ['тег'], priority: 2 });
    expect(parsed.tokens[0]).toEqual({
      kind: 'list',
      start: 5,
      end: 5 + token.length,
      text: token,
    });
    expect(toTaskCreate(parsed)).toMatchObject({ list_id: id });
  });
  it('keeps unknown, ambiguous and repeated mentions as literal title text', () => {
    const ambiguous = [...lists, makeList({ id: 'extra', name: 'Личные планы' })];
    expect(parseQuickAdd('Дело @личные @неизвестно', now, ambiguous)).toMatchObject({
      title: 'Дело @личные @неизвестно',
      listId: null,
      tokens: [],
    });
    expect(parseQuickAdd('@неизвестно @работа @елка', now, lists)).toMatchObject({
      title: '@неизвестно @елка',
      listId: 'work',
    });
  });
  it('does not interpret dates inside unknown mentions or match emails and word prefixes', () => {
    expect(parseQuickAdd('Дело @завтра mail@работа @работать', now, lists)).toMatchObject({
      title: 'Дело @завтра mail@работа @работать',
      dueDate: null,
      tokens: [],
    });
    expect(parseQuickAdd('Дело @работа', now)).toMatchObject({
      title: 'Дело @работа',
      listId: null,
    });
  });
  it('recognizes dashes/numbers and prefers tokens over the open list', () => {
    const extra = [...lists, makeList({ id: 'q4', name: 'Q4_план-2' })];
    expect(parseQuickAdd('Дело @q4_ПЛАН-2', now, extra).listId).toBe('q4');
    expect(
      prepareQuickAdd('Дело @работа', { kind: 'taskList', listId: 'personal' }, now, null, lists)
        .task,
    ).toMatchObject({ list_id: 'work' });
    expect(
      prepareQuickAdd('Дело', { kind: 'taskList', listId: 'personal' }, now, null, lists).task,
    ).toMatchObject({ list_id: 'personal' });
    expect(
      prepareQuickAdd('@работа', { kind: 'list', list: 'today' }, now, null, lists).issue,
    ).toBe('title-required');
  });
});
