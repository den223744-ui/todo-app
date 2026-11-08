// @vitest-environment jsdom
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../../api';
import { App } from '../../App';
import type { TaskRead } from '../../api/schema';
import { makeTask } from '../../test/makeTask';
import { renderWithClient } from '../../test/renderWithClient';

const A = makeTask({ id: 'a', title: 'Первая', position: 1 });
const B = makeTask({ id: 'b', title: 'Вторая', position: 2 });

function openInApp(taskId: string, tasks: TaskRead[]) {
  window.history.replaceState(null, '', `/?list=inbox&task=${taskId}`);
  let store = [...tasks];
  vi.spyOn(api, 'listTasks').mockImplementation(() => Promise.resolve(store));
  vi.spyOn(api, 'deleteTask').mockImplementation((id) => {
    store = store.filter((task) => task.id !== id);
    return Promise.resolve();
  });
  return renderWithClient(<App />, tasks);
}

describe('focus after deleting the open task', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('moves to the next task in the list', async () => {
    const { queryClient } = openInApp('a', [A, B]);

    await userEvent.click(screen.getByRole('button', { name: 'Удалить задачу' }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Вторая/ })).toHaveFocus();
    });
    queryClient.clear();
  });

  it('moves to the previous task when it was the last one', async () => {
    const { queryClient } = openInApp('b', [A, B]);

    await userEvent.click(screen.getByRole('button', { name: 'Удалить задачу' }));

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Первая/ })).toHaveFocus();
    });
    queryClient.clear();
  });

  it('moves to quick add when no task is left', async () => {
    const { queryClient } = openInApp('a', [A]);

    await userEvent.click(screen.getByRole('button', { name: 'Удалить задачу' }));

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'Новая задача' })).toHaveFocus();
    });
    queryClient.clear();
  });
});

/** A matchMedia whose answer the test can change, telling listeners. */
function stubScreen(initiallyNarrow: boolean) {
  let narrow = initiallyNarrow;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', (query: string) => ({
    media: query,
    get matches() {
      return query.includes('max-width') ? narrow : !narrow;
    },
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }));
  return (value: boolean) => {
    narrow = value;
    for (const listener of listeners) listener();
  };
}

describe('detail panel on a narrow screen', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('is a modal dialog that keeps Tab inside', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      media: query,
      matches: true,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
    const { queryClient } = openInApp('a', [A, B]);
    const dialog = screen.getByRole('dialog', { name: 'Детали задачи' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    screen.getByRole('button', { name: 'Удалить задачу' }).focus(); // the last control
    await userEvent.tab();

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    queryClient.clear();
  });

  it('keeps Shift+Tab inside from the heading it opens on', async () => {
    stubScreen(true);
    const { queryClient } = openInApp('a', [A, B]);
    const dialog = screen.getByRole('dialog', { name: 'Детали задачи' });
    expect(screen.getByRole('heading', { name: 'Детали задачи' })).toHaveFocus();

    await userEvent.tab({ shift: true });

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    queryClient.clear();
  });

  it('pulls focus in when the window narrows and the panel becomes a modal', () => {
    const setNarrow = stubScreen(false);
    const { queryClient } = openInApp('a', [A, B]);
    screen.getByRole('link', { name: /Вторая/ }).focus(); // working in the list

    act(() => {
      setNarrow(true);
    });

    expect(screen.getByRole('heading', { name: 'Детали задачи' })).toHaveFocus();
    queryClient.clear();
  });
});
