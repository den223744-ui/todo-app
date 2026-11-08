import { describe, expect, it } from 'vitest';

import { TEXTS, plural } from './texts';

describe('plural', () => {
  it.each([
    [1, 'задача'],
    [2, 'задачи'],
    [4, 'задачи'],
    [5, 'задач'],
    [11, 'задач'],
    [12, 'задач'],
    [14, 'задач'],
    [21, 'задача'],
    [22, 'задачи'],
    [25, 'задач'],
    [101, 'задача'],
    [111, 'задач'],
    [0, 'задач'],
  ])('%i %s', (count, expected) => {
    expect(plural(count, 'задача', 'задачи', 'задач')).toBe(expected);
  });

  it('builds a task count', () => {
    expect(TEXTS.taskCount(3)).toBe('3 задачи');
  });
});
