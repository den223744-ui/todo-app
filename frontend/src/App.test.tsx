// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('shows today by default', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: 'Сегодня' })).toBeInTheDocument();
  });

  it.each([
    ['/?list=upcoming', 'Предстоящие'],
    ['/?tag=%D0%B4%D0%BE%D0%BC', '#дом'],
  ])('titles the view from the URL %s', (url, title) => {
    window.history.replaceState(null, '', url);

    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });
});
