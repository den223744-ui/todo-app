/**
 * The app location (view, search, open task) read from and written to the URL
 * query string. Back/forward buttons work: popstate re-renders subscribers.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { parseLocation, serializeLocation, type AppLocation } from '../../domain/view';

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('popstate', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('popstate', listener);
  };
}

const getSearch = () => window.location.search;
const getServerSearch = () => '';

export interface NavigateOptions {
  /** Replace the history entry instead of adding one (e.g. while typing a search). */
  replace?: boolean;
}

export function navigateTo(patch: Partial<AppLocation>, options: NavigateOptions = {}): void {
  const next = { ...parseLocation(window.location.search), ...patch };
  const url = `${window.location.pathname}${serializeLocation(next)}`;
  if (options.replace) window.history.replaceState(null, '', url);
  else window.history.pushState(null, '', url);
  for (const listener of listeners) listener();
}

export function useAppLocation(): [
  AppLocation,
  (patch: Partial<AppLocation>, options?: NavigateOptions) => void,
] {
  const search = useSyncExternalStore(subscribe, getSearch, getServerSearch);
  const location = useMemo(() => parseLocation(search), [search]);
  const navigate = useCallback(navigateTo, []);
  return [location, navigate];
}
