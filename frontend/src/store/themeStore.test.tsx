// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
});

it('mounts with system selected when localStorage contains an unknown value', async () => {
  localStorage.setItem('tood-theme', 'broken');
  vi.resetModules();
  const { ThemePicker } = await import('../features/theme/ThemePicker');
  const { ThemeSync } = await import('../features/theme/ThemeSync');
  render(
    <>
      <ThemePicker />
      <ThemeSync />
    </>,
  );
  expect(screen.getByRole('radio', { name: 'Как в системе' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(document.documentElement).not.toHaveAttribute('data-theme');
});

it('mounts with system selected when access to localStorage itself throws', async () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.resetModules();
  const { ThemePicker } = await import('../features/theme/ThemePicker');
  const { ThemeSync } = await import('../features/theme/ThemeSync');
  render(
    <>
      <ThemePicker />
      <ThemeSync />
    </>,
  );
  expect(screen.getByRole('radio', { name: 'Как в системе' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
});
