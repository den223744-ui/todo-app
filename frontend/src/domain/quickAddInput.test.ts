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
