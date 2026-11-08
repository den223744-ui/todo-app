/**
 * Shared test setup: jest-dom matchers (toBeVisible, toHaveFocus, ...) and
 * DOM cleanup after each component test. Domain tests run in plain Node.
 */
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

afterEach(async () => {
  if (typeof document !== 'undefined') {
    const { cleanup } = await import('@testing-library/react');
    cleanup();
    window.history.replaceState(null, '', '/');
  }
});
