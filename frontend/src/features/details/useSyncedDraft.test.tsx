// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSyncedDraft } from './useSyncedDraft';

describe('useSyncedDraft', () => {
  it('follows outside changes while the user has not edited', () => {
    const { result, rerender } = renderHook(({ stored }) => useSyncedDraft(stored), {
      initialProps: { stored: 'a' },
    });

    rerender({ stored: 'b' });

    expect(result.current.draft).toBe('b');
    expect(result.current.dirty).toBe(false);
  });

  it('keeps the user’s edit when the stored value changes (e.g. a rollback)', () => {
    const { result, rerender } = renderHook(({ stored }) => useSyncedDraft(stored), {
      initialProps: { stored: 'saved' },
    });
    act(() => {
      result.current.setDraft('typing more');
    });

    rerender({ stored: 'old' });

    expect(result.current.draft).toBe('typing more');
    expect(result.current.dirty).toBe(true);
  });

  it('a saved draft follows its own rollback when nothing new was typed', () => {
    const { result, rerender } = renderHook(({ stored }) => useSyncedDraft(stored), {
      initialProps: { stored: 'old' },
    });
    act(() => {
      result.current.setDraft('new');
    });

    rerender({ stored: 'new' }); // the optimistic update of this save
    expect(result.current.dirty).toBe(false);

    // The save failed and was rolled back: the field shows what is stored,
    // matching the toast "the change was cancelled".
    rerender({ stored: 'old' });
    expect(result.current.draft).toBe('old');
  });

  it('reverts to the stored value', () => {
    const { result } = renderHook(() => useSyncedDraft('stored'));
    act(() => {
      result.current.setDraft('changed');
    });

    act(() => {
      result.current.revert();
    });

    expect(result.current.draft).toBe('stored');
  });
});
