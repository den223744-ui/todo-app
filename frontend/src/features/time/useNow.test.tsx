// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNow } from './useNow';

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 9, 23, 59, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts at the current time', () => {
    const { result } = renderHook(() => useNow());

    expect(result.current).toEqual(new Date(2026, 10, 9, 23, 59, 30));
  });

  it('ticks at the next minute boundary and then every minute', () => {
    const { result } = renderHook(() => useNow());

    act(() => {
      vi.advanceTimersByTime(30_000); // to 00:00:00 — a new day
    });
    expect(result.current).toEqual(new Date(2026, 10, 10, 0, 0, 0));

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current).toEqual(new Date(2026, 10, 10, 0, 1, 0));
  });

  it('stops ticking after unmount', () => {
    const { unmount } = renderHook(() => useNow());
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
