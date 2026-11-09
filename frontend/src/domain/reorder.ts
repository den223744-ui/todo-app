import type { TaskRead } from '../api/schema';
import { moveTo, type Positioned } from './position';
import { compareByPosition } from './taskCache';
import type { TaskGroup } from './taskGroups';
import type { AppLocation } from './view';

export function canReorderGroup(location: AppLocation, key: string): boolean {
  if (location.query.trim() || key === 'tomorrow') return false;
  const view = location.view;
  return view.kind !== 'list' || view.list === 'inbox' || view.list === 'today';
}

export function reorderSiblings(group: TaskGroup): TaskRead[] {
  return group.tasks.filter((task) => task.completed_at === null);
}

/** On precision exhaustion, reassign global slots, keeping hidden tasks in order.
 * This rare fallback also patches hidden parents; subtasks have their own order.
 */
export function reorderPatches(
  siblings: readonly Positioned[],
  id: string,
  toIndex: number,
  universe: readonly Positioned[] = siblings,
): Positioned[] {
  const from = siblings.findIndex((item) => item.id === id);
  const target = Math.max(0, Math.min(toIndex, siblings.length - 1));
  if (from < 0 || from === target) return [];
  const result = moveTo(siblings, id, target);
  if (result.kind === 'single') return [{ id, position: result.position }];
  const visible = new Set(siblings.map((item) => item.id));
  const ordered = result.positions;
  let index = 0;
  return [...universe]
    .sort((a, b) => a.position - b.position)
    .map((item) => (visible.has(item.id) ? (ordered[index++] as Positioned) : item))
    .map((item, i) => ({ id: item.id, position: i + 1 }));
}

export function topLevelOrder(tasks: readonly TaskRead[]): TaskRead[] {
  return tasks.filter((task) => task.parent_id === null).sort(compareByPosition);
}
