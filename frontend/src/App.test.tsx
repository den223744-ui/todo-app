// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { renderWithClient } from './test/renderWithClient';

describe('App', () => {
  it('shows today by default', () => {
    renderWithClient(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Сегодня' })).toBeInTheDocument();
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
