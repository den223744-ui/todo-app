import { describe, expect, it } from 'vitest';

import { parseQuickAdd, toTaskCreate } from './quickAdd';

// Monday, 9 November 2026, 10:30 local time.
const MONDAY = new Date(2026, 10, 9, 10, 30);

const parse = (input: string, now = MONDAY) => parseQuickAdd(input, now);
const dueDate = (input: string, now = MONDAY) => parse(input, now).dueDate;

describe('SPEC example', () => {
  it('купить молоко завтра в 18:00 #дом !!', () => {
    const input = 'купить молоко завтра в 18:00 #дом !!';
    const result = parse(input);

    expect(result).toMatchObject({
      title: 'купить молоко',
      dueDate: '2026-11-10',
      dueTime: '18:00',
      tags: ['дом'],
      priority: 2,
    });
    expect(result.tokens.map((t) => [t.kind, t.text])).toEqual([
      ['date', 'завтра'],
      ['time', 'в 18:00'],
      ['tag', '#дом'],
      ['priority', '!!'],
    ]);
    for (const token of result.tokens) {
      expect(input.slice(token.start, token.end)).toBe(token.text);
    }
  });
});

describe('empty and trivial input', () => {
  it.each(['', '   '])('%j gives an empty result', (input) => {
    expect(parse(input)).toEqual({
      title: '',
      dueDate: null,
      dueTime: null,
      tags: [],
      priority: 0,
      tokens: [],
    });
  });

  it('plain text is the title, whitespace collapsed', () => {
    expect(parse('  просто   задача ')).toMatchObject({ title: 'просто задача', tokens: [] });
  });

  it('only tags leave no title', () => {
    const result = parse('#дом #работа');

    expect(result).toMatchObject({ title: '', tags: ['дом', 'работа'] });
    expect(toTaskCreate(result)).toBeNull();
  });
});

describe('relative days', () => {
  it.each([
    ['сегодня', '2026-11-09'],
    ['завтра', '2026-11-10'],
    ['послезавтра', '2026-11-11'],
    ['ЗАВТРА', '2026-11-10'],
  ])('%s -> %s', (word, expected) => {
    expect(dueDate(`позвонить ${word}`)).toBe(expected);
  });

  it('crosses month and year boundaries', () => {
    expect(dueDate('завтра', new Date(2026, 11, 31, 9, 0))).toBe('2027-01-01');
  });
});

describe('weekdays', () => {
  it.each([
    ['вт', '2026-11-10'],
    ['вторник', '2026-11-10'],
    ['ср', '2026-11-11'],
    ['среда', '2026-11-11'],
    ['среду', '2026-11-11'],
    ['чт', '2026-11-12'],
    ['четверг', '2026-11-12'],
    ['пт', '2026-11-13'],
    ['пятница', '2026-11-13'],
    ['пятницу', '2026-11-13'],
    ['сб', '2026-11-14'],
    ['суббота', '2026-11-14'],
    ['субботу', '2026-11-14'],
    ['вс', '2026-11-15'],
    ['воскресенье', '2026-11-15'],
  ])('%s from Monday -> %s', (word, expected) => {
    expect(dueDate(word)).toBe(expected);
  });

  it('"пн" on a Monday means next Monday', () => {
    expect(dueDate('пн')).toBe('2026-11-16');
    expect(dueDate('понедельник')).toBe('2026-11-16');
  });

  it('the same rule on another day: "вс" on a Sunday', () => {
    expect(dueDate('вс', new Date(2026, 10, 15, 12, 0))).toBe('2026-11-22');
  });

  it('takes the preposition into the token', () => {
    const result = parse('встреча в пятницу');
    expect(result).toMatchObject({ title: 'встреча', dueDate: '2026-11-13' });
    expect(result.tokens[0]?.text).toBe('в пятницу');

    expect(parse('отчёт во вторник').title).toBe('отчёт');
  });
});

describe('через N дней', () => {
  it.each([
    ['через 1 день', '2026-11-10'],
    ['через 2 дня', '2026-11-11'],
    ['через 5 дней', '2026-11-14'],
    ['через 365 дней', '2027-11-09'],
    ['через 366 дней', '2027-11-10'],
    ['через 1000 дней', '2029-08-05'],
  ])('%s -> %s', (phrase, expected) => {
    expect(dueDate(`задача ${phrase}`)).toBe(expected);
  });

  it.each(['через 0 дней', 'через 000 дней', `через ${'9'.repeat(30)} дней`])(
    '%s is not recognized',
    (phrase) => {
      expect(parse(phrase)).toMatchObject({ title: phrase, dueDate: null, tokens: [] });
    },
  );
});

describe('дд.мм', () => {
  it.each([
    ['15.11', '2026-11-15'],
    ['09.11', '2026-11-09'],
    ['9.11', '2026-11-09'],
    ['01.01', '2027-01-01'],
    ['1.5', '2027-05-01'],
    ['31.12', '2026-12-31'],
  ])('%s -> %s', (text, expected) => {
    expect(dueDate(`оплатить ${text}`)).toBe(expected);
  });

  it.each(['31.02', '29.02', '00.05', '12.13', '32.01'])('%s is not a date', (text) => {
    expect(parse(`оплатить ${text}`)).toMatchObject({
      title: `оплатить ${text}`,
      dueDate: null,
      tokens: [],
    });
  });

  it('29.02 is a date in a year where it exists', () => {
    expect(dueDate('29.02', new Date(2027, 5, 1))).toBe('2028-02-29');
  });

  it.each([
    '10.11.2026',
    'версия 1.5.2',
    '123.45',
    'проверить v1.5',
    '1.5beta',
    'x15.11',
    '15.11б',
  ])('%s is left alone', (text) => {
    expect(parse(text)).toMatchObject({ title: text, dueDate: null });
  });

  it('punctuation around a date is fine', () => {
    expect(parse('оплатить (15.11), срочно')).toMatchObject({ dueDate: '2026-11-15' });
  });
});

describe('time', () => {
  it.each([
    ['завтра в 18', '18:00'],
    ['завтра в 9:05', '09:05'],
    ['завтра в 0:00', '00:00'],
    ['завтра в 23:59', '23:59'],
  ])('%s -> %s', (text, expected) => {
    expect(parse(text).dueTime).toBe(expected);
  });

  it.each(['завтра в 24', 'завтра в 18:60', 'завтра в 18:5'])('%s has no time', (text) => {
    expect(parse(text).dueTime).toBeNull();
  });

  it('time without a date is today when still ahead', () => {
    expect(parse('позвонить в 18:00')).toMatchObject({
      title: 'позвонить',
      dueDate: '2026-11-09',
      dueTime: '18:00',
    });
  });

  it('time without a date is tomorrow when already passed', () => {
    expect(parse('позвонить в 9').dueDate).toBe('2026-11-10');
  });

  it('the current minute counts as passed', () => {
    expect(parse('позвонить в 10:30').dueDate).toBe('2026-11-10');
    expect(parse('позвонить в 10:31').dueDate).toBe('2026-11-09');
  });

  it('a time before the date works too', () => {
    expect(parse('в 18:00 завтра')).toMatchObject({ dueDate: '2026-11-10', dueTime: '18:00' });
  });
});

describe('tags', () => {
  it('collects every tag, normalized and deduplicated', () => {
    expect(parse('#Дом купить #работа #ДОМ хлеб').tags).toEqual(['дом', 'работа']);
  });

  it('allows digits, dashes and underscores', () => {
    expect(parse('#q4-план_2026').tags).toEqual(['q4-план_2026']);
  });

  it('needs a space or the start before #', () => {
    expect(parse('почта a#b и issue#12')).toMatchObject({ tags: [], tokens: [] });
  });

  it('a lone # is text', () => {
    expect(parse('пункт # 3')).toMatchObject({ title: 'пункт # 3', tags: [] });
  });
});

describe('priority', () => {
  it.each([
    ['!', 1],
    ['!!', 2],
    ['!!!', 3],
  ])('%s -> %i', (marks, expected) => {
    expect(parse(`срочно ${marks}`).priority).toBe(expected);
  });

  it.each(['!!!!', 'привет!', '!!срочно'])('%s is not a priority', (text) => {
    expect(parse(text)).toMatchObject({ priority: 0, title: text });
  });

  it('works at the start of the input', () => {
    expect(parse('!!! пожар')).toMatchObject({ priority: 3, title: 'пожар' });
  });
});

describe('whole words only', () => {
  it.each([
    'завтрак',
    'сегодняшний отчёт',
    'средство',
    'пнд',
    'вторники',
    'вт2',
    'назавтра',
    'ксегодня',
    'кпн',
    'дочерез 2 дня',
  ])('%s is not a date', (text) => {
    expect(parse(text)).toMatchObject({ title: text, dueDate: null, tokens: [] });
  });

  it('"в" must be a separate word for time', () => {
    expect(parse('ив 18').dueTime).toBeNull();
  });
});

describe('repeats', () => {
  it('the first date wins; later ones stay in the title', () => {
    const result = parse('завтра или пятница');

    expect(result).toMatchObject({ dueDate: '2026-11-10', title: 'или пятница' });
    expect(result.tokens).toHaveLength(1);
  });

  it('the first time and priority win', () => {
    expect(parse('завтра в 9 или в 10 ! !!!')).toMatchObject({
      dueTime: '09:00',
      priority: 1,
      title: 'или в 10 !!!',
    });
  });

  it('an invalid first date does not block a valid later one', () => {
    expect(parse('31.02 или 15.11')).toMatchObject({ dueDate: '2026-11-15', title: '31.02 или' });
  });
});

describe('toTaskCreate', () => {
  it('maps the result to a create body', () => {
    expect(toTaskCreate(parse('купить молоко завтра в 18:00 #дом !!'))).toEqual({
      title: 'купить молоко',
      due_date: '2026-11-10',
      due_time: '18:00',
      tags: ['дом'],
      priority: 2,
    });
  });

  it('keeps nulls for absent date and time', () => {
    expect(toTaskCreate(parse('просто задача'))).toEqual({
      title: 'просто задача',
      due_date: null,
      due_time: null,
      tags: [],
      priority: 0,
    });
  });
});
