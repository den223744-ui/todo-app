import { describe, expect, it } from 'vitest';

import { parseQuickAdd } from './quickAdd';
import { prepareQuickAdd, quickAddSegments } from './quickAddInput';
import type { View } from './view';

const now = new Date(2026, 10, 8, 12);
const today: View = { kind: 'list', list: 'today' };

describe('prepareQuickAdd', () => {
  it('supplies the local date for today, without changing parser highlights', () => {
    const result = prepareQuickAdd('Купить молоко', today, now);
    expect(result.task).toEqual({
      title: 'Купить молоко',
      due_date: '2026-11-08',
      due_time: null,
      tags: [],
      priority: 0,
    });
    expect(result.parsed.tokens).toEqual([]);
    expect(result.issue).toBeNull();
  });

  it.each(['inbox', 'upcoming', 'overdue', 'completed'] as const)(
    'does not invent a date in %s',
    (list) => {
      expect(prepareQuickAdd('Задача', { kind: 'list', list }, now).task?.due_date).toBeNull();
    },
  );

  it('dates an undated task on Today with the day shown there', () => {
    expect(prepareQuickAdd('Отчёт', today, now, '2026-11-12').task?.due_date).toBe('2026-11-12');
  });

  it('puts a task typed into one of the user lists into that list', () => {
    expect(prepareQuickAdd('Отчёт', { kind: 'taskList', listId: 'work' }, now).task).toMatchObject({
      title: 'Отчёт',
      due_date: null,
      list_id: 'work',
    });
    expect(prepareQuickAdd('Отчёт', today, now).task).not.toHaveProperty('list_id');
  });

  it('preserves an explicit date and time in today', () => {
    expect(prepareQuickAdd('Молоко завтра в 18:00 #дом !!', today, now).task).toEqual({
      title: 'Молоко',
      due_date: '2026-11-09',
      due_time: '18:00',
      tags: ['дом'],
      priority: 2,
    });
  });

  it('preserves the parser date for a time that has already passed today', () => {
    expect(prepareQuickAdd('Задача в 10:00', today, now).task?.due_date).toBe('2026-11-09');
  });

  it('merges the contextual tag with explicit tags and removes duplicates', () => {
    expect(prepareQuickAdd('Задача #покупки', { kind: 'tag', tag: 'дом' }, now).task?.tags).toEqual(
      ['покупки', 'дом'],
    );
    expect(
      prepareQuickAdd('Задача #ДОМ #дом', { kind: 'tag', tag: 'дом' }, now).task?.tags,
    ).toEqual(['дом']);
    expect(prepareQuickAdd('Задача', { kind: 'tag', tag: 'дом' }, now).task).toMatchObject({
      due_date: null,
      tags: ['дом'],
    });
  });

  it.each(['', '   ', 'завтра #дом !!'])('rejects %j without a title', (input) => {
    expect(prepareQuickAdd(input, today, now)).toMatchObject({
      task: null,
      issue: 'title-required',
    });
  });

  it('validates the parsed title length by Unicode code points, excluding tokens', () => {
    expect(prepareQuickAdd(`${'😀'.repeat(500)} завтра #дом`, today, now).issue).toBeNull();
    expect(prepareQuickAdd('а'.repeat(501), today, now)).toMatchObject({
      task: null,
      issue: 'title-too-long',
    });
  });

  it('uses the supplied calendar day after midnight', () => {
    expect(prepareQuickAdd('Задача', today, new Date(2026, 10, 9, 0, 0)).task?.due_date).toBe(
      '2026-11-09',
    );
  });
});

describe('quickAddSegments', () => {
  it('handles empty input and plain literal text', () => {
    expect(quickAddSegments('', [])).toEqual([]);
    expect(quickAddSegments('<img src=x>  текст', [])).toEqual([
      { text: '<img src=x>  текст', kind: null },
    ]);
  });

  it('preserves every input character and recognized token kind, including spaces', () => {
    const input = '  молоко завтра в 18:00 #дом !!  ';
    const result = quickAddSegments(input, parseQuickAdd(input, now).tokens);
    expect(result.map((segment) => segment.text).join('')).toBe(input);
    expect(result.filter((segment) => segment.kind).map(({ text, kind }) => [text, kind])).toEqual([
      ['завтра', 'date'],
      ['в 18:00', 'time'],
      ['#дом', 'tag'],
      ['!!', 'priority'],
    ]);
  });

  it('does not add empty segments at the edges or between adjacent tokens', () => {
    expect(
      quickAddSegments('ab', [
        { start: 0, end: 1, kind: 'date', text: 'a' },
        { start: 1, end: 2, kind: 'tag', text: 'b' },
      ]),
    ).toEqual([
      { text: 'a', kind: 'date' },
      { text: 'b', kind: 'tag' },
    ]);
  });
});

describe('API limits for tags', () => {
  const inbox = { kind: 'list', list: 'inbox' } as const;
  const now = new Date(2026, 10, 8, 12);

  it('accepts a tag of 50 characters and 20 tags', () => {
    const twenty = Array.from({ length: 20 }, (_, i) => `#t${String(i)}`).join(' ');
    expect(prepareQuickAdd(`Задача #${'я'.repeat(50)}`, inbox, now).issue).toBeNull();
    expect(prepareQuickAdd(`Задача ${twenty}`, inbox, now).issue).toBeNull();
  });

  it('rejects a tag longer than 50 characters', () => {
    expect(prepareQuickAdd(`Задача #${'я'.repeat(51)}`, inbox, now)).toMatchObject({
      task: null,
      issue: 'tag-too-long',
    });
  });

  it('rejects more than 20 tags, counting the tag of the current view', () => {
    const twenty = Array.from({ length: 20 }, (_, i) => `#t${String(i)}`).join(' ');
    expect(prepareQuickAdd(`Задача ${twenty} #t21`, inbox, now).issue).toBe('too-many-tags');
    expect(prepareQuickAdd(`Задача ${twenty}`, { kind: 'tag', tag: 'дом' }, now)).toMatchObject({
      task: null,
      issue: 'too-many-tags',
    });
    // The view tag is already among the typed ones: still 20.
    expect(prepareQuickAdd(`Задача ${twenty}`, { kind: 'tag', tag: 't0' }, now).issue).toBeNull();
  });

  it('counts emoji as one character, like the server', () => {
    expect(prepareQuickAdd(`Задача #${'😀'.repeat(50)}`, inbox, now).issue).toBeNull();
  });
});
