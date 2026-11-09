import { describe, expect, it } from 'vitest';
import { makeList } from '../test/makeList';
import { makeTask } from '../test/makeTask';
import { detachList, restoreTaskLists, revertListUpdate } from './listCache';

describe('list cache transformations', () => {
  it('reverts exactly the written list fields', () => {
    const previous = makeList({ id: 'work', name: 'Старое', color: 'blue', position: 1 });
    const current = {
      ...previous,
      name: 'Новое',
      color: 'red' as const,
      position: 2,
      updated_at: 'later',
    };
    expect(revertListUpdate(current, previous, { name: 'Новое' })).toEqual({
      ...current,
      name: previous.name,
      updated_at: previous.updated_at,
    });
    expect(revertListUpdate(current, previous, { color: 'red', position: 2 })).toEqual({
      ...previous,
      name: 'Новое',
    });
  });
  it('detaches only the deleted list and restores only still-unassigned affected tasks', () => {
    const assigned = makeTask({ id: 'assigned', list_id: 'work' });
    const loose = makeTask({ id: 'loose' });
    const other = makeTask({ id: 'other', list_id: 'home' });
    const before = [assigned, loose, other];
    const detached = detachList(before, 'work');
    expect(detached).toEqual([{ ...assigned, list_id: null }, loose, other]);
    expect(before[0]?.list_id).toBe('work');
    const affected = new Set(['assigned', 'other', 'gone']);
    expect(
      restoreTaskLists(
        [{ ...assigned, list_id: null, title: 'Edited' }, loose, other],
        affected,
        'work',
      ),
    ).toEqual([{ ...assigned, title: 'Edited' }, loose, other]);
    expect(detachList([], 'work')).toEqual([]);
    expect(restoreTaskLists([], affected, 'work')).toEqual([]);
  });
});
