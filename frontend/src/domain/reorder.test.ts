import { describe, expect, it } from 'vitest';

import { makeTask } from '../test/makeTask';

import { canReorderGroup, reorderPatches, reorderSiblings, topLevelOrder } from './reorder';
import { DEFAULT_LOCATION } from './view';

describe('visible-group ordering', () => {
  const siblings = [
    { id: 'a', position: 1 },
    { id: 'b', position: 2 },
    { id: 'c', position: 3 },
  ];
  it('moves to middle, start and end, clamps and ignores missing/no-op moves', () => {
    expect(reorderPatches(siblings, 'a', 1)).toEqual([{ id: 'a', position: 2.5 }]);
    expect(reorderPatches(siblings, 'c', -5)).toEqual([{ id: 'c', position: 0 }]);
    expect(reorderPatches(siblings, 'a', 99)).toEqual([{ id: 'a', position: 4 }]);
    expect(reorderPatches(siblings, 'b', 1)).toEqual([]);
    expect(reorderPatches(siblings, 'missing', 1)).toEqual([]);
    expect(reorderPatches([], 'a', 0)).toEqual([]);
  });
  it('rebalances global slots without changing hidden-task order', () => {
    const visible = [
      { id: 'a', position: 1 },
      { id: 'b', position: 1 + Number.EPSILON },
      { id: 'c', position: 3 },
    ];
    const all = [...visible, { id: 'hidden1', position: 0 }, { id: 'hidden2', position: 2 }];
    expect(reorderPatches(visible, 'c', 1, all)).toEqual([
      { id: 'hidden1', position: 1 },
      { id: 'a', position: 2 },
      { id: 'c', position: 3 },
      { id: 'hidden2', position: 4 },
      { id: 'b', position: 5 },
    ]);
    expect(all[0]?.position).toBe(1);
  });
  it('limits eligibility and excludes done tasks and subtasks', () => {
    for (const list of ['inbox', 'today'] as const)
      expect(canReorderGroup({ ...DEFAULT_LOCATION, view: { kind: 'list', list } }, 'all')).toBe(
        true,
      );
    for (const list of ['upcoming', 'overdue', 'completed'] as const)
      expect(canReorderGroup({ ...DEFAULT_LOCATION, view: { kind: 'list', list } }, 'all')).toBe(
        false,
      );
    expect(canReorderGroup({ ...DEFAULT_LOCATION, view: { kind: 'tag', tag: 'a' } }, 'all')).toBe(
      true,
    );
    expect(
      canReorderGroup({ ...DEFAULT_LOCATION, view: { kind: 'taskList', listId: 'l' } }, 'all'),
    ).toBe(true);
    expect(canReorderGroup(DEFAULT_LOCATION, 'tomorrow')).toBe(false);
    expect(canReorderGroup({ ...DEFAULT_LOCATION, query: ' a ' }, 'all')).toBe(false);
    const a = makeTask({ id: 'a', position: 2 });
    const b = makeTask({ id: 'b', position: 1, completed_at: '2026-11-09T12:00:00Z' });
    expect(reorderSiblings({ key: 'all', tasks: [a, b] })).toEqual([a]);
    expect(topLevelOrder([a, makeTask({ id: 'child', parent_id: 'a' }), b])).toEqual([b, a]);
  });
});
