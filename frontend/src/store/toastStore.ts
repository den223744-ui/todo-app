/** Toast notifications: UI-only state (AGENTS.md: Zustand for UI state). */
import { create } from 'zustand';

export interface ToastAction {
  label: string;
  run: () => void;
  /** An undo: Ctrl/Cmd+Z runs the newest one. */
  undo?: boolean;
}

export interface Toast {
  id: number;
  message: string;
  action?: ToastAction | undefined;
  /** Milliseconds before it hides itself; the default when absent. */
  duration?: number | undefined;
}

export interface ToastOptions {
  action?: ToastAction;
  duration?: number;
  /** Distinct successful operations may have identical messages. Defaults to true. */
  deduplicate?: boolean;
}

/** Older toasts give way: more than this many at once is noise. */
export const MAX_TOASTS = 3;

interface ToastState {
  toasts: Toast[];
  /** Returns the toast's id (to close it early), or null when it was a repeat. */
  showToast: (message: string, options?: ToastOptions) => number | null;
  dismissToast: (id: number) => void;
  /** Run and close the newest undo toast; false when there is none. */
  undoLatest: () => boolean;
}

let nextId = 1;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],
  showToast: (message, options = {}) => {
    // The same plain message twice in a row (e.g. two failed saves) shows once.
    const last = get().toasts.at(-1);
    if (
      options.deduplicate !== false &&
      !options.action &&
      last?.message === message &&
      !last.action
    )
      return null;
    const toast: Toast = {
      id: nextId++,
      message,
      action: options.action,
      duration: options.duration,
    };
    set((state) => ({ toasts: [...state.toasts, toast].slice(-MAX_TOASTS) }));
    return toast.id;
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
  undoLatest: () => {
    const toast = [...get().toasts].reverse().find((candidate) => candidate.action?.undo === true);
    if (!toast?.action) return false;
    get().dismissToast(toast.id);
    toast.action.run();
    return true;
  },
}));
