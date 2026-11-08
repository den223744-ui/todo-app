// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { useUiStore } from '../../store/uiStore';
import { makeTask } from '../../test/makeTask';
import { renderWithClient } from '../../test/renderWithClient';
import { SidebarContainer } from './SidebarContainer';

describe('SidebarContainer', () => {
  it('navigates via the URL, closes the open task and the mobile drawer', async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, '', '/?list=inbox&task=t1');
    useUiStore.setState({ drawerOpen: true });
    renderWithClient(<SidebarContainer />, [makeTask({ id: 't1', tags: ['дом'] })]);

    await user.click(screen.getByRole('link', { name: /дом/ }));

    expect(window.location.search).toBe('?tag=%D0%B4%D0%BE%D0%BC');
    expect(useUiStore.getState().drawerOpen).toBe(false);
    expect(screen.getByRole('link', { name: /дом/ })).toHaveAttribute('aria-current', 'page');
  });
});
