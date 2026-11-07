import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App';
import { TEXTS } from './constants/texts';

describe('App', () => {
  it('renders the app title as the main heading', () => {
    const html = renderToStaticMarkup(<App />);

    expect(html).toContain(`<h1`);
    expect(html).toContain(TEXTS.appTitle);
  });
});
