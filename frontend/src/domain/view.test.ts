import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCATION, parseLocation, sameView, serializeLocation } from './view';

describe('parseLocation', () => {
  it('defaults to today with no search and no open task', () => {
    expect(parseLocation('')).toEqual(DEFAULT_LOCATION);
  });

  it.each(['inbox', 'today', 'upcoming', 'overdue', 'completed'])('reads list=%s', (list) => {
    expect(parseLocation(`?list=${list}`).view).toEqual({ kind: 'list', list });
  });

  it.each(['?list=nope', '?list=', '?list=Today'])('falls back to today for %s', (search) => {
    expect(parseLocation(search).view).toEqual({ kind: 'list', list: 'today' });
  });

  it('reads a tag, normalized, and lets it win over the list', () => {
    expect(parseLocation('?list=inbox&tag=%23%D0%94%D0%BE%D0%BC').view).toEqual({
      kind: 'tag',
      tag: 'дом',
    });
  });

  it('ignores an empty tag', () => {
    expect(parseLocation('?tag=%23&list=upcoming').view).toEqual({
      kind: 'list',
      list: 'upcoming',
    });
  });

  it('reads search and the open task', () => {
    expect(parseLocation('?q=%20молоко%20&task=abc')).toMatchObject({
      query: 'молоко',
      taskId: 'abc',
    });
    expect(parseLocation('?task=').taskId).toBeNull();
  });
});

describe('serializeLocation', () => {
  it('leaves the default location empty', () => {
    expect(serializeLocation(DEFAULT_LOCATION)).toBe('');
  });

  it('writes non-default parts', () => {
    expect(
      serializeLocation({
        view: { kind: 'list', list: 'upcoming' },
        query: ' хлеб ',
        taskId: 't1',
      }),
    ).toBe('?list=upcoming&q=%D1%85%D0%BB%D0%B5%D0%B1&task=t1');
  });

  it('writes a tag instead of a list and skips a blank search', () => {
    expect(
      serializeLocation({ view: { kind: 'tag', tag: 'дом' }, query: '  ', taskId: null }),
    ).toBe('?tag=%D0%B4%D0%BE%D0%BC');
  });

  it.each(['?list=upcoming', '?tag=%D0%B4%D0%BE%D0%BC&q=x', '?list=completed&task=abc', ''])(
    'round-trips %j',
    (search) => {
      expect(serializeLocation(parseLocation(search))).toBe(search);
    },
  );
});

describe('sameView', () => {
  it.each([
    [{ kind: 'list', list: 'today' }, { kind: 'list', list: 'today' }, true],
    [{ kind: 'list', list: 'today' }, { kind: 'list', list: 'inbox' }, false],
    [{ kind: 'tag', tag: 'a' }, { kind: 'tag', tag: 'a' }, true],
    [{ kind: 'tag', tag: 'a' }, { kind: 'tag', tag: 'b' }, false],
    [{ kind: 'tag', tag: 'a' }, { kind: 'list', list: 'today' }, false],
    [{ kind: 'list', list: 'today' }, { kind: 'tag', tag: 'a' }, false],
  ] as const)('%o vs %o -> %s', (a, b, expected) => {
    expect(sameView(a, b)).toBe(expected);
  });
});
