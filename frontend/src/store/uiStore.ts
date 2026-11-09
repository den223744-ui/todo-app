/**
 * UI-only state (AGENTS.md: Zustand holds UI state, never server data).
 * What is shareable lives in the URL instead (view, search, open task).
 */
import { create } from 'zustand';

interface UiState {
  /** Mobile navigation drawer. */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** The task whose title is being edited inline, if any. */
  editingTaskId: string | null;
  startEditing: (taskId: string) => void;
  stopEditing: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  drawerOpen: false,
  openDrawer: () => {
    set({ drawerOpen: true });
  },
  closeDrawer: () => {
    set({ drawerOpen: false });
  },
  editingTaskId: null,
  startEditing: (taskId) => {
    set({ editingTaskId: taskId });
  },
  stopEditing: () => {
    set({ editingTaskId: null });
  },
}));
