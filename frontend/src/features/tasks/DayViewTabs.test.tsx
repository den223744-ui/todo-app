// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it } from 'vitest';

import { useUiStore } from '../../store/uiStore';

import { DayViewTabs } from './DayViewTabs';

afterEach(() => {
  useUiStore.setState({ dayView: 'list' });
});

it('switches by click and arrow/Home/End keys with a single tab stop', async () => {
  render(<DayViewTabs />);
  const list = screen.getByRole('tab', { name: 'Список' });
  const timeline = screen.getByRole('tab', { name: 'Таймлайн' });
  expect(list).toHaveAttribute('aria-selected', 'true');
  expect(timeline).toHaveAttribute('tabindex', '-1');
  await userEvent.click(timeline);
  expect(timeline).toHaveAttribute('aria-selected', 'true');
  expect(list).toHaveAttribute('tabindex', '-1');
  await userEvent.keyboard('{ArrowLeft}');
  expect(list).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}');
  expect(timeline).toHaveFocus();
  await userEvent.keyboard('{Home}');
  expect(list).toHaveFocus();
  await userEvent.keyboard('{End}');
  expect(timeline).toHaveFocus();
  await userEvent.keyboard('a');
  expect(useUiStore.getState().dayView).toBe('timeline');
});
