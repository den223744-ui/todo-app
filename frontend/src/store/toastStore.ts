/** Toast notifications: UI-only state (Zustand holds UI state, never server data). */
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
  secondaryAction?: ToastAction | undefined;
  /** Milliseconds before it hides itself; the default when absent. */
  duration?: number | undefined;
  /** Absolute UI deadline: moving a toast into mobile details must not restart Undo. */
  expiresAt?: number;
}

export interface ToastOptions {
  action?: ToastAction;
  secondaryAction?: ToastAction | undefined;
  duration?: number;
  /** Distinct successful operations may have identical messages. Defaults to true. */
  deduplicate?: boolean;
}

/** Older toasts give way: more than this many at once is noise. */
export const MAX_TOASTS = 3;
export const DEFAULT_TOAST_DURATION_MS = 6_000;

interface ToastState {
  toasts: Toast[];
  /** Returns the toast's id (to close it early), or null when it was a repeat. */
  showToast: (message: string, options?: ToastOptions) => number | null;
  dismissToast: (id: number) => void;
  updateToast: (id: number, message: string, options?: ToastOptions) => void;
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
      !options.secondaryAction &&
      last?.message === message &&
      !last.action &&
      !last.secondaryAction
    )
      return null;
    const toast: Toast = {
      id: nextId++,
      message,
      action: options.action,
      secondaryAction: options.secondaryAction,
      duration: options.duration,
      expiresAt: Date.now() + (options.duration ?? DEFAULT_TOAST_DURATION_MS),
    };
    set((state) => ({ toasts: [...state.toasts, toast].slice(-MAX_TOASTS) }));
    return toast.id;
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
  updateToast: (id, message, options = {}) => {
    set((state) => ({
      toasts: state.toasts.map((toast) =>
        toast.id === id ? { ...toast, ...options, message } : toast,
      ),
    }));
  },
  undoLatest: () => {
    const toast = [...get().toasts]
      .reverse()
      .find(
        (candidate) =>
          candidate.action?.undo === true &&
          (candidate.expiresAt === undefined || candidate.expiresAt > Date.now()),
      );
    if (!toast?.action) return false;
    get().dismissToast(toast.id);
    toast.action.run();
    return true;
  },
}));
