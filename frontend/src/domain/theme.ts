export const THEME_KEY = 'tood-theme';
export const THEMES = ['light', 'dark', 'system'] as const;
export type Theme = (typeof THEMES)[number];

// Keep validation/key in sync with the pre-paint script in frontend/index.html.
export function validateTheme(value: unknown): Theme {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function readTheme(storage: Pick<Storage, 'getItem'>): Theme {
  try {
    return validateTheme(storage.getItem(THEME_KEY));
  } catch {
    return 'system';
  }
}
