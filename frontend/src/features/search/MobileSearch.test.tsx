// @vitest-environment jsdom
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it } from 'vitest';

import { renderWithClient } from '../../test/renderWithClient';
import { MobileSearch } from './MobileSearch';

it('opens and focuses search, clears before collapsing with Esc, and returns focus', async () => {
  const { queryClient } = renderWithClient(<MobileSearch />);
  const trigger = screen.getByRole('button', { name: 'Открыть поиск' });
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('searchbox')).toBeNull();
  await userEvent.click(trigger);
  const input = screen.getByRole('searchbox');
  expect(input).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await userEvent.type(input, 'текст ');
  await userEvent.keyboard('{Escape}');
  expect(input).toHaveValue('');
  expect(input).toHaveFocus();
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('searchbox')).toBeNull();
  expect(trigger).toHaveFocus();
  queryClient.clear();
});

it('opens a query from the URL, clears by button and collapses only when empty', async () => {
  window.history.replaceState(null, '', '/?q=текст');
  const { queryClient } = renderWithClient(<MobileSearch />);
  expect(screen.getByRole('searchbox')).toHaveValue('текст');
  await userEvent.click(screen.getByRole('button', { name: 'Закрыть поиск' }));
  expect(screen.getByRole('searchbox')).toHaveValue('');
  await userEvent.click(screen.getByRole('button', { name: 'Закрыть поиск' }));
  expect(screen.queryByRole('searchbox')).toBeNull();
  act(() => {
    window.history.replaceState(null, '', '/?q=назад');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(screen.getByRole('searchbox')).toHaveValue('назад');
  queryClient.clear();
});
