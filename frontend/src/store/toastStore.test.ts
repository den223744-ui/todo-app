import { beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('updates a pending creation in place, preserves Undo and ignores an already dismissed toast', () => {
    const store = useToastStore.getState();
    const undo = vi.fn();
    const show = vi.fn();
    const id = store.showToast('Добавлено', {
      action: { label: 'Отменить', undo: true, run: undo },
      duration: 5_000,
    });
    if (id === null) throw new Error('Missing toast');
    store.updateToast(id, 'Добавлено в «Работа»', {
      secondaryAction: { label: 'Показать', run: show },
    });
    expect(store.toasts).toHaveLength(0); // store snapshots are immutable
    expect(useToastStore.getState().toasts[0]).toMatchObject({
      id,
      duration: 5_000,
      message: 'Добавлено в «Работа»',
      action: { undo: true },
      secondaryAction: { label: 'Показать' },
    });
    expect(store.undoLatest()).toBe(true);
    expect(undo).toHaveBeenCalledOnce();
    expect(show).not.toHaveBeenCalled();
    store.updateToast(id, 'Late response');
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it('does not deduplicate two messages with secondary actions', () => {
    const store = useToastStore.getState();
    store.showToast('a', { secondaryAction: { label: 'Show', run: vi.fn() } });
    store.showToast('a', { secondaryAction: { label: 'Show', run: vi.fn() } });
    expect(messages()).toEqual(['a', 'a']);
  });

  it('does not undo an expired offer even before the mounted toaster removes it', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const run = vi.fn();
    const store = useToastStore.getState();
    const id = store.showToast('Added', {
      duration: 5_000,
      action: { label: 'Undo', undo: true, run },
    });
    expect(useToastStore.getState().toasts[0]?.expiresAt).toBe(6_000);
    now.mockReturnValue(6_000);
    expect(store.undoLatest()).toBe(false);
    expect(run).not.toHaveBeenCalled();
    if (id !== null) store.updateToast(id, 'Saved');
    expect(useToastStore.getState().toasts[0]?.expiresAt).toBe(6_000);
    now.mockRestore();
  });
});
