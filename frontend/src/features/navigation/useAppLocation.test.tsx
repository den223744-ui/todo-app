// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useAppLocation } from './useAppLocation';
import { makeList } from '../../test/makeList';
import { viewTitle } from './viewTitle';

describe('useAppLocation', () => {
  it('reads the current URL', () => {
    window.history.replaceState(null, '', '/?list=upcoming&q=x');

    const { result } = renderHook(() => useAppLocation());

    expect(result.current[0]).toEqual({
      view: { kind: 'list', list: 'upcoming' },
      query: 'x',
      taskId: null,
    });
  });

  it('navigates by pushing a history entry and re-renders', () => {
    const { result } = renderHook(() => useAppLocation());
    const before = window.history.length;

    act(() => {
      result.current[1]({ view: { kind: 'tag', tag: 'дом' } });
    });

    expect(result.current[0].view).toEqual({ kind: 'tag', tag: 'дом' });
    expect(window.location.search).toBe('?tag=%D0%B4%D0%BE%D0%BC');
    expect(window.history.length).toBe(before + 1);
  });

  it('keeps the other parts when patching one', () => {
    window.history.replaceState(null, '', '/?list=inbox&task=t1');
    const { result } = renderHook(() => useAppLocation());

    act(() => {
      result.current[1]({ query: 'молоко' });
    });

    expect(result.current[0]).toMatchObject({ query: 'молоко', taskId: 't1' });
    expect(result.current[0].view).toEqual({ kind: 'list', list: 'inbox' });
  });

  it('can replace the entry instead of adding one', () => {
    const { result } = renderHook(() => useAppLocation());
    const before = window.history.length;

    act(() => {
      result.current[1]({ query: 'a' }, { replace: true });
    });

    expect(window.history.length).toBe(before);
    expect(result.current[0].query).toBe('a');
  });

  it('follows the back button (popstate)', () => {
    const { result } = renderHook(() => useAppLocation());

    act(() => {
      window.history.replaceState(null, '', '/?list=completed');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    expect(result.current[0].view).toEqual({ kind: 'list', list: 'completed' });
  });

  it('stops listening after unmount', () => {
    const { result, unmount } = renderHook(() => useAppLocation());
    const navigate = result.current[1];
    unmount();

    expect(() => {
      navigate({ query: 'after' });
    }).not.toThrow();
    expect(window.location.search).toBe('?q=after');
  });
});

describe('viewTitle', () => {
  it('names smart lists and tags', () => {
    expect(viewTitle({ kind: 'list', list: 'today' })).toBe('Сегодня');
    expect(viewTitle({ kind: 'tag', tag: 'дом' })).toBe('#дом');
  });

  it('names one of the user lists, with a fallback while lists load', () => {
    const lists = [makeList({ id: 'work', name: 'Работа' })];
    expect(viewTitle({ kind: 'taskList', listId: 'work' }, lists)).toBe('Работа');
    expect(viewTitle({ kind: 'taskList', listId: 'work' })).toBe('Список');
  });
});
