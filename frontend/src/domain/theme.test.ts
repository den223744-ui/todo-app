import { expect, it } from 'vitest';
import { readTheme, validateTheme } from './theme';

it('validates stored themes and handles unavailable or corrupt storage', () => {
  for (const value of ['light', 'dark', 'system'] as const)
    expect(validateTheme(value)).toBe(value);
  for (const value of [null, undefined, '', 'wrong', '{}', 7])
    expect(validateTheme(value)).toBe('system');
  expect(readTheme({ getItem: () => 'dark' })).toBe('dark');
  expect(readTheme({ getItem: () => null })).toBe('system');
  expect(
    readTheme({
      getItem: () => {
        throw new Error('blocked');
      },
    }),
  ).toBe('system');
});
