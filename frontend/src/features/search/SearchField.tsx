import { useId, useState } from 'react';

import { SEARCH_TEXTS } from '../../constants/texts';
import { useAppLocation } from '../navigation/useAppLocation';

/**
 * Search within the current view; the query lives in the URL (?q=…).
 *
 * The field keeps its own draft: the URL holds the trimmed query, and binding
 * the field to it directly would eat a trailing space while typing
 * ("купить " -> "купить"). The draft follows the URL only when the URL changes
 * from outside (back/forward, a link).
 */
export function SearchField() {
  const [location, navigate] = useAppLocation();
  const [draft, setDraft] = useState(location.query);
  const [seen, setSeen] = useState(location.query);
  if (seen !== location.query) {
    setSeen(location.query);
    if (draft.trim() !== location.query) setDraft(location.query);
  }
  const id = useId();

  return (
    <div role="search" className="w-full md:w-64">
      <label htmlFor={id} className="sr-only">
        {SEARCH_TEXTS.label}
      </label>
      <input
        id={id}
        type="search"
        value={draft}
        placeholder={SEARCH_TEXTS.placeholder}
        autoComplete="off"
        onChange={(event) => {
          const value = event.currentTarget.value;
          setDraft(value);
          // Replace, not push: every keystroke must not become a Back step.
          if (value.trim() !== location.query) navigate({ query: value }, { replace: true });
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && draft) {
            event.preventDefault();
            setDraft('');
            navigate({ query: '' }, { replace: true });
          }
        }}
        className="w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-base shadow-soft placeholder:text-ink-faint md:text-sm"
      />
    </div>
  );
}
