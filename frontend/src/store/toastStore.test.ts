import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_TOASTS, useToastStore } from './toastStore';

const messages = () => useToastStore.getState().toasts.map((toast) => toast.message);

describe('toastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('shows and dismisses toasts', () => {
    useToastStore.getState().showToast('a');
    useToastStore.getState().showToast('b');
    const [first] = useToastStore.getState().toasts;

    useToastStore.getState().dismissToast(first?.id ?? -1);

    expect(messages()).toEqual(['b']);
  });

  it('keeps only the newest few', () => {
    for (const message of ['1', '2', '3', '4']) useToastStore.getState().showToast(message);

    expect(messages()).toEqual(['2', '3', '4']);
    expect(messages()).toHaveLength(MAX_TOASTS);
  });

  it('does not repeat the same message back to back', () => {
    for (const message of ['same', 'same', 'other', 'same']) {
      useToastStore.getState().showToast(message);
    }

    expect(messages()).toEqual(['same', 'other', 'same']);
  });

  it('can show separate confirmations for distinct operations with the same message', () => {
    const store = useToastStore.getState();
    const first = store.showToast('same', { duration: 4_000, deduplicate: false });
    const second = store.showToast('same', { duration: 4_000, deduplicate: false });
    expect(messages()).toEqual(['same', 'same']);
    expect(second).not.toBe(first);
    expect(useToastStore.getState().toasts.map((toast) => toast.duration)).toEqual([4_000, 4_000]);
  });
});
