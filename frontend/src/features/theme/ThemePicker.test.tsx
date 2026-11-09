// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { useThemeStore } from '../../store/themeStore';

import { ThemePicker } from './ThemePicker';
import { ThemeSync } from './ThemeSync';

beforeEach(() => {
  localStorage.clear();
  useThemeStore.getState().setTheme('system');
});
afterEach(() => {
  vi.restoreAllMocks();
});

it('applies, persists and clears explicit themes with radio keyboard navigation', async () => {
  render(
    <>
      <ThemePicker />
      <ThemeSync />
    </>,
  );
  await userEvent.click(screen.getByRole('radio', { name: 'Светлая' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  expect(localStorage.getItem('tood-theme')).toBe('light');
  await userEvent.keyboard('{ArrowRight}');
  expect(screen.getByRole('radio', { name: 'Тёмная' })).toHaveFocus();
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  await userEvent.keyboard('{End}');
  expect(document.documentElement).not.toHaveAttribute('data-theme');
  expect(localStorage.getItem('tood-theme')).toBe('system');
  await userEvent.keyboard('{ArrowLeft}{Home}');
  expect(screen.getByRole('radio', { name: 'Светлая' })).toHaveAttribute('aria-checked', 'true');
});

it('keeps the UI usable when localStorage writes throw and validates corrupt storage events', async () => {
  render(
    <>
      <ThemePicker />
      <ThemeSync />
    </>,
  );
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  await userEvent.click(screen.getByRole('radio', { name: 'Тёмная' }));
  expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  act(() => {
    window.dispatchEvent(new StorageEvent('storage', { key: 'tood-theme', newValue: 'broken' }));
  });
  expect(screen.getByRole('radio', { name: 'Как в системе' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(document.documentElement).not.toHaveAttribute('data-theme');
});
