import { describe, expect, it } from 'vitest';

import { greeting, TEXTS } from './texts';

describe('greeting', () => {
  it.each([
    [5, 'Доброе утро'],
    [11, 'Доброе утро'],
    [12, 'Добрый день'],
    [17, 'Добрый день'],
    [18, 'Добрый вечер'],
    [23, 'Добрый вечер'],
    [0, 'Добрый вечер'],
    [4, 'Добрый вечер'],
  ])('at %i:00 says %s', (hour, expected) => {
    expect(greeting(hour)).toBe(expected);
  });
});

describe('taskCount', () => {
  it.each([
    [1, '1 задача'],
    [2, '2 задачи'],
    [5, '5 задач'],
    [11, '11 задач'],
    [12, '12 задач'],
    [21, '21 задача'],
    [22, '22 задачи'],
    [114, '114 задач'],
  ])('%i -> %s', (count, expected) => {
    expect(TEXTS.taskCount(count)).toBe(expected);
  });
});
