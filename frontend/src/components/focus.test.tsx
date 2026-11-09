// @vitest-environment jsdom
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUiStore } from '../store/uiStore';

import { AppShell } from './AppShell';
import { useFocusTrap } from './useFocusTrap';
import { useMediaQuery } from './useMediaQuery';

function Trap({
  active,
  empty = false,
  heading = false,
}: {
  active: boolean;
  empty?: boolean;
  heading?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, active);
  return (
    <>
      <button type="button">outside</button>
      <div ref={ref} tabIndex={-1} data-testid="trap">
        {heading && (
          <h2 tabIndex={-1} data-testid="heading">
            Заголовок
          </h2>
        )}
        {!empty && (
          <>
            <button type="button">first</button>
            <button type="button">middle</button>
            <button type="button">last</button>
          </>
        )}
      </div>
    </>
  );
}

const button = (name: string) => screen.getByRole('button', { name });

describe('useFocusTrap', () => {
  it('wraps Tab from the last element to the first and Shift+Tab back', async () => {
    render(<Trap active />);

    button('last').focus();
    await userEvent.tab();
    expect(button('first')).toHaveFocus();

    await userEvent.tab({ shift: true });
    expect(button('last')).toHaveFocus();
  });

  it('moves along normally inside', async () => {
    render(<Trap active />);

    button('first').focus();
    await userEvent.tab();

    expect(button('middle')).toHaveFocus();
  });

  it('pulls focus back in from outside, and from the container itself', async () => {
    render(<Trap active />);

    button('outside').focus();
    await userEvent.tab();
    expect(button('first')).toHaveFocus();

    screen.getByTestId('trap').focus();
    await userEvent.tab({ shift: true });
    expect(button('last')).toHaveFocus();
  });

  it('wraps Shift+Tab from an untabbable element at the top (a focused heading)', async () => {
    render(<Trap active heading />);
    screen.getByTestId('heading').focus();

    await userEvent.tab({ shift: true });
    expect(button('last')).toHaveFocus();

    screen.getByTestId('heading').focus();
    await userEvent.tab();
    expect(button('first')).toHaveFocus();
  });

  it('does nothing while inactive', async () => {
    render(<Trap active={false} />);

    button('last').focus();
    await userEvent.tab();

    expect(button('first')).not.toHaveFocus();
  });

  it('keeps focus where it is when nothing inside can take it', async () => {
    render(<Trap active empty />);
    screen.getByTestId('trap').focus();

    await userEvent.tab();

    expect(screen.getByTestId('trap')).toHaveFocus();
  });
});

describe('mobile navigation drawer', () => {
  beforeEach(() => {
    useUiStore.setState({ drawerOpen: false });
  });

  it('keeps Tab inside the open drawer', async () => {
    render(
      <AppShell sidebar={<a href="#inbox">Входящие</a>}>
        <a href="#main">В основном списке</a>
      </AppShell>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Открыть меню' }));
    const dialog = screen.getByRole('dialog', { name: 'Навигация' });
    const drawerLink = dialog.querySelector('a') as HTMLElement;

    drawerLink.focus();
    await userEvent.tab(); // past the last element of the drawer

    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('closes when the window widens and the sidebar is back', async () => {
    const listeners = new Set<() => void>();
    let wide = false;
    vi.stubGlobal('matchMedia', (query: string) => ({
      media: query,
      get matches() {
        return wide;
      },
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    }));
    render(
      <AppShell sidebar={<a href="#inbox">Входящие</a>}>
        <a href="#main">В основном списке</a>
      </AppShell>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Открыть меню' }));
    expect(screen.getByRole('dialog', { name: 'Навигация' })).toBeInTheDocument();

    act(() => {
      wide = true;
      for (const listener of listeners) listener();
    });

    expect(screen.queryByRole('dialog', { name: 'Навигация' })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});

describe('useMediaQuery', () => {
  const listeners = new Set<() => void>();
  let matches = false;

  beforeEach(() => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      media: query,
      get matches() {
        return matches;
      },
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    listeners.clear();
    matches = false;
  });

  it('follows the media query and unsubscribes', () => {
    const { result, unmount } = renderHook(() => useMediaQuery('(max-width: 1023.98px)'));
    expect(result.current).toBe(false);

    act(() => {
      matches = true;
      for (const listener of listeners) listener();
    });
    expect(result.current).toBe(true);

    unmount();
    expect(listeners.size).toBe(0);
  });

  it('is false where matchMedia does not exist', () => {
    vi.stubGlobal('matchMedia', undefined);

    const { result } = renderHook(() => useMediaQuery('(max-width: 1px)'));

    expect(result.current).toBe(false);
  });
});
