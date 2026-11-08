// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { renderWithClient } from './test/renderWithClient';

describe('App', () => {
  it('shows today by default: the date as the heading, named Today for screen readers', () => {
    renderWithClient(<App />);

    const heading = screen.getByRole('heading', { level: 1, name: /^Сегодня, / });
    expect(heading).toHaveTextContent(/\d/); // the day of the month
  });

  it.each([
    ['/?list=upcoming', 'Предстоящие'],
    ['/?tag=%D0%B4%D0%BE%D0%BC', '#дом'],
  ])('titles the view from the URL %s', (url, title) => {
    window.history.replaceState(null, '', url);

    renderWithClient(<App />);

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('switches Today to another day: heading, URL; the timeline sits on the right', async () => {
    window.history.replaceState(null, '', '/');
    renderWithClient(<App />);
    expect(screen.getByRole('region', { name: 'Таймлайн дня' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Следующий день' }));

    expect(window.location.search).toMatch(/^\?day=\d{4}-\d{2}-\d{2}$/);
    expect(screen.queryByRole('heading', { level: 1, name: /^Сегодня, / })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Сегодня' }));
    expect(window.location.search).toBe('');
  });

  it('shows an open task in place of the timeline', () => {
    window.history.replaceState(null, '', '/?task=gone');
    renderWithClient(<App />);

    expect(screen.queryByRole('region', { name: 'Таймлайн дня' })).toBeNull();
    expect(screen.getByText('Задача не найдена')).toBeInTheDocument();
  });

  it('has no timeline outside Today', () => {
    window.history.replaceState(null, '', '/?list=inbox');
    renderWithClient(<App />);

    expect(screen.queryByRole('region', { name: 'Таймлайн дня' })).toBeNull();
  });
});
