/**
 * UI-only state (AGENTS.md: Zustand holds UI state, never server data).
 * What is shareable lives in the URL instead (view, search, open task).
 */
import { create } from 'zustand';

interface UiState {
  dayView: 'list' | 'timeline';
  setDayView: (view: 'list' | 'timeline') => void;
  /** Mobile navigation drawer. */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** The task whose title is being edited inline, if any. */
  editingTaskId: string | null;
  startEditing: (taskId: string) => void;
  stopEditing: () => void;
  expandedTaskIds: ReadonlySet<string>;
  toggleSubtasks: (taskId: string) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  dayView: 'list',
  setDayView: (dayView) => {
    set({ dayView });
  },
  drawerOpen: false,
  openDrawer: () => {
    set({ drawerOpen: true });
  },
  closeDrawer: () => {
    set({ drawerOpen: false });
  },
  editingTaskId: null,
  expandedTaskIds: new Set(),
  toggleSubtasks: (taskId) => {
    set((state) => {
      const expandedTaskIds = new Set(state.expandedTaskIds);
      if (expandedTaskIds.has(taskId)) expandedTaskIds.delete(taskId);
      else expandedTaskIds.add(taskId);
      return { expandedTaskIds };
    });
  },
  startEditing: (taskId) => {
    set({ editingTaskId: taskId });
  },
  stopEditing: () => {
    set({ editingTaskId: null });
  },
}));
