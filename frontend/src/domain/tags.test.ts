import { describe, expect, it } from 'vitest';

import { normalizeTag, normalizeTags } from './tags';

describe('normalizeTag', () => {
  it.each([
    ['#Дом', 'дом'],
    ['  ДОМ ', 'дом'],
    ['##work', 'work'],
    ['# spaced ', 'spaced'],
    ['#', ''],
  ])('%j -> %j', (raw, expected) => {
    expect(normalizeTag(raw)).toBe(expected);
  });
});

describe('normalizeTags', () => {
  it('normalizes, drops empty tags and keeps the first occurrence', () => {
    expect(normalizeTags(['#Дом', 'работа', ' дом ', '', '#', 'Работа'])).toEqual([
      'дом',
      'работа',
    ]);
  });

  it('handles an empty list', () => {
    expect(normalizeTags([])).toEqual([]);
  });
});
