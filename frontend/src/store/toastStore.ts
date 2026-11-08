/** Toast notifications: UI-only state (AGENTS.md: Zustand for UI state). */
import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
}

/** Older toasts give way: more than this many at once is noise. */
export const MAX_TOASTS = 3;

interface ToastState {
  toasts: Toast[];
  showToast: (message: string) => void;
  dismissToast: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  showToast: (message) => {
    set((state) => {
      // The same message twice in a row (e.g. two failed saves) shows once.
      if (state.toasts.at(-1)?.message === message) return state;
      return { toasts: [...state.toasts, { id: nextId++, message }].slice(-MAX_TOASTS) };
    });
  },
  dismissToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));
