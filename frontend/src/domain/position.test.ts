import { describe, expect, it } from 'vitest';

import { moveTo, needsRebalance, positionBetween, type Positioned } from './position';

describe('positionBetween', () => {
  it.each([
    [null, null, 1],
    [null, 5, 4],
    [5, null, 6],
    [1, 2, 1.5],
    [-3, 7, 2],
  ])('between %s and %s -> %s', (prev, next, expected) => {
    expect(positionBetween(prev, next)).toBe(expected);
  });
});

describe('needsRebalance', () => {
  it('is false at the ends of a list', () => {
    expect(needsRebalance(null, 1)).toBe(false);
    expect(needsRebalance(1, null)).toBe(false);
    expect(needsRebalance(null, null)).toBe(false);
  });

  it('is false while a float fits between the neighbours', () => {
    expect(needsRebalance(1, 2)).toBe(false);
  });

  it('becomes true after repeated halving', () => {
    const prev = 1;
    let next = 2;
    let halvings = 0;
    // Bounded: a broken needsRebalance must fail the test, not hang it.
    while (!needsRebalance(prev, next) && halvings < 1000) {
      next = positionBetween(prev, next);
      halvings += 1;
    }
    // Roughly the float mantissa: the gap is exhausted after ~50 moves.
    expect(halvings).toBeGreaterThan(40);
    expect(halvings).toBeLessThan(60);
  });

  it('is true for equal neighbours', () => {
    expect(needsRebalance(3, 3)).toBe(true);
  });
});

describe('moveTo', () => {
  const list: Positioned[] = [
    { id: 'a', position: 1 },
    { id: 'b', position: 2 },
    { id: 'c', position: 3 },
  ];

  it.each([
    ['c', 0, 0], // to the top: before a
    ['a', 3, 4], // to the bottom: after c
    ['a', 1, 2.5], // between b and c (indexes count without the moved task)
    ['c', 1, 1.5], // between a and b
  ])('moving %s to index %i -> position %s', (id, toIndex, position) => {
    expect(moveTo(list, id, toIndex)).toEqual({ kind: 'single', id, position });
  });

  it('clamps the index into the list', () => {
    expect(moveTo(list, 'b', -5)).toEqual({ kind: 'single', id: 'b', position: 0 });
    expect(moveTo(list, 'b', 99)).toEqual({ kind: 'single', id: 'b', position: 4 });
  });

  it('works in an empty list and for a task from elsewhere', () => {
    expect(moveTo([], 'x', 0)).toEqual({ kind: 'single', id: 'x', position: 1 });
    expect(moveTo(list, 'new', 1)).toEqual({ kind: 'single', id: 'new', position: 1.5 });
  });

  it('renumbers the whole list when the gap is exhausted', () => {
    const tight: Positioned[] = [
      { id: 'a', position: 1 },
      { id: 'b', position: 1 + Number.EPSILON },
      { id: 'c', position: 5 },
    ];

    expect(moveTo(tight, 'c', 1)).toEqual({
      kind: 'rebalance',
      positions: [
        { id: 'a', position: 1 },
        { id: 'c', position: 2 },
        { id: 'b', position: 3 },
      ],
    });
  });
});
