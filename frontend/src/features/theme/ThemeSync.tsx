import { useEffect } from 'react';

import { validateTheme, THEME_KEY } from '../../domain/theme';
import { applyTheme, useThemeStore } from '../../store/themeStore';

export function ThemeSync() {
  const theme = useThemeStore((state) => state.theme);
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === THEME_KEY || event.key === null) {
        useThemeStore.getState().setTheme(validateTheme(event.newValue));
      }
    };
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('storage', sync);
    };
  }, []);
  return null;
}
