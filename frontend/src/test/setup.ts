/**
 * Shared test setup: jest-dom matchers (toBeVisible, toHaveFocus, ...) and
 * DOM cleanup after each component test. Domain tests run in plain Node.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

// jsdom has no geometry/scrolling implementation.
if (typeof window !== 'undefined') window.scrollTo = () => {};
if (typeof Element !== 'undefined' && !('scrollIntoView' in Element.prototype)) {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    value: () => {},
  });
}

afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
    window.history.replaceState(null, '', '/');
  }
});
