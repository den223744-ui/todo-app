/**
 * The user's lists (Работа, Дом, ...): a top-level task belongs to at most
 * one; subtasks follow their parent. Pure functions over cached data.
 */
import type { TaskListRead, TaskRead } from '../api/schema';

import { compareByPosition } from './taskCache';

const isTopLevel = (task: TaskRead) => task.parent_id === null;
const isOpen = (task: TaskRead) => task.completed_at === null;

/** Lists in display order: position, then creation time, then id. */
export function compareLists(a: TaskListRead, b: TaskListRead): number {
  return (
    a.position - b.position || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
  );
}

export interface ListGroup {
  /** null: tasks without a list (or whose list is gone), shown last. */
  list: TaskListRead | null;
  tasks: TaskRead[];
}

/** Split already selected tasks by list, lists in order, keeping each group's task order. */
export function groupByList(
  tasks: readonly TaskRead[],
  lists: readonly TaskListRead[],
): ListGroup[] {
  const known = new Set(lists.map((list) => list.id));
  const groups = [...lists].sort(compareLists).map((list) => ({
    list,
    tasks: tasks.filter((task) => task.list_id === list.id),
  }));
  const loose = tasks.filter((task) => task.list_id === null || !known.has(task.list_id));
  return [...groups, { list: null, tasks: loose }].filter((group) => group.tasks.length > 0);
}

/** Incomplete top-level tasks of a list, in the manual order. */
export function selectInList(tasks: readonly TaskRead[], listId: string): TaskRead[] {
  return tasks
    .filter((task) => isTopLevel(task) && isOpen(task) && task.list_id === listId)
    .sort(compareByPosition);
}

/** Sidebar badges: incomplete top-level tasks per list id. */
export function countByList(tasks: readonly TaskRead[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (!isTopLevel(task) || !isOpen(task) || task.list_id === null) continue;
    counts.set(task.list_id, (counts.get(task.list_id) ?? 0) + 1);
  }
  return counts;
}

export interface Progress {
  done: number;
  total: number;
}

/** "N of M done" over the shown tasks and their subtasks. */
export function progressOf(shown: readonly TaskRead[], all: readonly TaskRead[]): Progress {
  const ids = new Set(shown.map((task) => task.id));
  const counted = [
    ...shown,
    ...all.filter((task) => task.parent_id !== null && ids.has(task.parent_id)),
  ];
  return {
    done: counted.filter((task) => !isOpen(task)).length,
    total: counted.length,
  };
}
