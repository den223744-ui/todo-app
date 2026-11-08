// @vitest-environment jsdom
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { App } from '../../App';
import { SEARCH_TEXTS } from '../../constants/texts';
import { makeTask } from '../../test/makeTask';
import { renderWithClient } from '../../test/renderWithClient';

const TASKS = [
  makeTask({ id: 'a', title: 'Купить хлеб', position: 1 }),
  makeTask({ id: 'b', title: 'Купить молоко', position: 2 }),
  makeTask({ id: 'c', title: 'Позвонить маме', position: 3 }),
];

const titles = () =>
  screen
    .queryAllByRole('link')
    .filter((link) => link.hasAttribute('data-task-link'))
    .map((link) => link.textContent);

describe('SearchField', () => {
  it('searches all tasks as you type, spaces included, from any view', async () => {
    window.history.replaceState(null, '', '/?list=upcoming');
    const { queryClient } = renderWithClient(<App />, TASKS);
    const search = screen.getByRole('searchbox', { name: 'Поиск по задачам' });
    expect(search).toHaveAttribute('placeholder', SEARCH_TEXTS.placeholder);

    await userEvent.type(search, 'купить х');

    expect(search).toHaveValue('купить х'); // the space was not eaten
    expect(titles()).toEqual(['Купить хлеб']);
    expect(window.location.search).toBe(
      '?list=upcoming&q=%D0%BA%D1%83%D0%BF%D0%B8%D1%82%D1%8C+%D1%85',
    );
    queryClient.clear();
  });

  it('does not add a history entry per keystroke', async () => {
    window.history.replaceState(null, '', '/?list=inbox');
    const { queryClient } = renderWithClient(<App />, TASKS);
    const before = window.history.length;

    await userEvent.type(screen.getByRole('searchbox'), 'молоко');

    expect(window.history.length).toBe(before);
    queryClient.clear();
  });

  it('clears with Escape', async () => {
    window.history.replaceState(null, '', '/?list=inbox&q=%D1%85%D0%BB%D0%B5%D0%B1');
    const { queryClient } = renderWithClient(<App />, TASKS);
    const search = screen.getByRole('searchbox');
    expect(search).toHaveValue('хлеб');

    search.focus();
    await userEvent.keyboard('{Escape}');

    expect(search).toHaveValue('');
    expect(window.location.search).toBe('?list=inbox');
    expect(titles()).toHaveLength(3);
    queryClient.clear();
  });

  it('follows the URL when it changes from outside (back button)', () => {
    window.history.replaceState(null, '', '/?list=inbox');
    const { queryClient } = renderWithClient(<App />, TASKS);

    act(() => {
      window.history.replaceState(null, '', '/?list=inbox&q=%D0%BC%D0%B0%D0%BC%D0%B5');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(screen.getByRole('searchbox')).toHaveValue('маме');
    expect(titles()).toEqual(['Позвонить маме']);
    queryClient.clear();
  });

  it('shows the search empty state when nothing matches', async () => {
    window.history.replaceState(null, '', '/?list=inbox');
    const { queryClient } = renderWithClient(<App />, TASKS);

    await userEvent.type(screen.getByRole('searchbox'), 'ничего');

    expect(screen.getByText('Ничего не найдено')).toBeInTheDocument();
    queryClient.clear();
  });
});
