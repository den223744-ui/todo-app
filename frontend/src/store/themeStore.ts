import { create } from 'zustand';
import { readTheme, THEME_KEY, type Theme } from '../domain/theme';

function initialTheme(): Theme {
  try {
    return readTheme(window.localStorage);
  } catch {
    return 'system';
  }
}

export function applyTheme(theme: Theme): void {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
}

export const useThemeStore = create<{ theme: Theme; setTheme: (theme: Theme) => void }>((set) => ({
  theme: initialTheme(),
  setTheme: (theme) => {
    set({ theme });
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_KEY, theme);
    } catch {
      // The current session still follows the selected theme when storage is blocked.
    }
  },
}));
