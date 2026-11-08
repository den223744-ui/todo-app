import { useState } from 'react';

/**
 * A text field's draft that follows the stored value — but never over the
 * user's own edits.
 *
 * When the stored value changes from outside (the server's answer, a rename
 * elsewhere, a rollback after a failed save), the draft takes it only if the
 * user has not changed the draft since the last time it matched. Otherwise a
 * rollback of an earlier save would wipe what the user is typing right now.
 */
export function useSyncedDraft(stored: string) {
  const [draft, setDraft] = useState(stored);
  const [base, setBase] = useState(stored);
  if (base !== stored) {
    setBase(stored);
    if (draft === base) setDraft(stored);
  }
  return {
    draft,
    setDraft,
    dirty: draft !== stored,
    revert: () => {
      setDraft(stored);
    },
  };
}
