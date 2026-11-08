// @vitest-environment jsdom
import { screen } from '@testing-library/react';
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
});
