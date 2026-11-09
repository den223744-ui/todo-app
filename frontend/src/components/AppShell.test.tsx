// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from '../store/uiStore';
import { AppShell } from './AppShell';

function renderShell() {
  return render(
    <AppShell sidebar={<a href="#inbox">Входящие</a>} details={<aside aria-label="Детали" />}>
      <h1>Сегодня</h1>
    </AppShell>,
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    useUiStore.setState({ drawerOpen: false });
  });

  it('lays out navigation, main content and details', () => {
    renderShell();

    expect(screen.getByRole('complementary', { name: 'Навигация' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', { name: 'Сегодня' }),
    );
    expect(screen.getByRole('complementary', { name: 'Детали' })).toBeInTheDocument();
  });

  it('opens the navigation drawer from the menu button and moves focus into it', async () => {
    const user = userEvent.setup();
    renderShell();
    const menu = screen.getByRole('button', { name: 'Открыть меню' });
    expect(menu).toHaveAttribute('aria-expanded', 'false');

    await user.click(menu);

    const drawer = screen.getByRole('dialog', { name: 'Навигация' });
    expect(drawer).toHaveFocus();
    expect(drawer).toHaveAttribute('aria-modal', 'true');
    expect(menu).toHaveAttribute('aria-expanded', 'true');
  });

  it('closes the drawer with Escape and returns focus to the menu button', async () => {
    const user = userEvent.setup();
    renderShell();
    const menu = screen.getByRole('button', { name: 'Открыть меню' });
    await user.click(menu);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(menu).toHaveFocus();
  });

  it('closes the drawer with its close button', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));

    await user.click(screen.getByRole('button', { name: 'Закрыть меню' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the drawer on a backdrop click', async () => {
    const user = userEvent.setup();
    const { container } = renderShell();
    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));

    const backdrop = container.ownerDocument.querySelector('.bg-black\\/40');
    expect(backdrop).not.toBeNull();
    await user.click(backdrop as Element);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ignores other keys while the drawer is open', async () => {
    const user = userEvent.setup();
    renderShell();
    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));

    await user.keyboard('a');

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
