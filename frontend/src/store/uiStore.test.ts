import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState({ drawerOpen: false, editingTaskId: null });
  });

  it('opens and closes the drawer', () => {
    useUiStore.getState().openDrawer();
    expect(useUiStore.getState().drawerOpen).toBe(true);

    useUiStore.getState().closeDrawer();
    expect(useUiStore.getState().drawerOpen).toBe(false);
  });

  it('tracks the task being edited', () => {
    useUiStore.getState().startEditing('t1');
    expect(useUiStore.getState().editingTaskId).toBe('t1');

    useUiStore.getState().stopEditing();
    expect(useUiStore.getState().editingTaskId).toBeNull();
  });
});
