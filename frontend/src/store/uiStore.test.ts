import { beforeEach, describe, expect, it } from 'vitest';

import { useUiStore } from './uiStore';

describe('uiStore', () => {
  beforeEach(() => {
    useUiStore.setState({ drawerOpen: false, editingTaskId: null, expandedTaskIds: new Set() });
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
  it('toggles expanded ids immutably and independently of editing', () => {
    const before = useUiStore.getState().expandedTaskIds;
    useUiStore.getState().toggleSubtasks('t1');
    useUiStore.getState().toggleSubtasks('t2');
    expect([...useUiStore.getState().expandedTaskIds]).toEqual(['t1', 't2']);
    expect(before.size).toBe(0);
    useUiStore.getState().toggleSubtasks('t1');
    expect([...useUiStore.getState().expandedTaskIds]).toEqual(['t2']);
  });
});
