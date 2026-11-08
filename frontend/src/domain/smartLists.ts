/**
 * Smart lists, tag lists, counts and ordering (rules: SPEC.md, "Умные списки").
 *
 *   inbox     — no due date
 *   today     — due today + overdue (overdue as a separate group on top)
 *   upcoming  — due after today
 *   overdue   — due before today (by date; the time does not matter)
 *   completed — completed
 *
 * All lists except "completed" hold incomplete tasks only. Lists show top-level
 * tasks; subtasks live in their parent's detail panel. "Today" is the local
 * date of `now`, passed in by the caller.
 */
import type { TaskRead } from '../api/schema';
import { canonicalTime, toLocalDateString } from './dates';
import { compareByPosition } from './taskCache';

export const SMART_LISTS = ['inbox', 'today', 'upcoming', 'overdue', 'completed'] as const;
export type SmartList = (typeof SMART_LISTS)[number];

export function isSmartList(value: string): value is SmartList {
  return (SMART_LISTS as readonly string[]).includes(value);
}

const isTopLevel = (task: TaskRead) => task.parent_id === null;
const isOpen = (task: TaskRead) => task.completed_at === null;

export function isOverdue(task: TaskRead, today: string): boolean {
  return isOpen(task) && task.due_date !== null && task.due_date < today;
}

export function belongsTo(task: TaskRead, list: SmartList, today: string): boolean {
  if (list === 'completed') return !isOpen(task);
  if (!isOpen(task)) return false;
  const due = task.due_date;
  switch (list) {
    case 'inbox':
      return due === null;
    case 'today':
      return due !== null && due <= today;
    case 'upcoming':
      return due !== null && due > today;
    case 'overdue':
      return due !== null && due < today;
  }
}

/** By date (oldest first), then time (untimed last), then the manual order. */
export function compareByDue(a: TaskRead, b: TaskRead): number {
  return (
    (a.due_date ?? '').localeCompare(b.due_date ?? '') ||
    canonicalTime(a.due_time ?? '99:99').localeCompare(canonicalTime(b.due_time ?? '99:99')) ||
    compareByPosition(a, b)
  );
}

/** Most recently completed first. */
export function compareCompleted(a: TaskRead, b: TaskRead): number {
  return (b.completed_at ?? '').localeCompare(a.completed_at ?? '') || compareByPosition(a, b);
}

const LIST_ORDER: Record<SmartList, (a: TaskRead, b: TaskRead) => number> = {
  inbox: compareByPosition,
  today: compareByPosition,
  upcoming: compareByDue,
  overdue: compareByDue,
  completed: compareCompleted,
};

/** The top-level tasks of a smart list, in display order. */
export function selectList(tasks: readonly TaskRead[], list: SmartList, now: Date): TaskRead[] {
  const today = toLocalDateString(now);
  return tasks
    .filter((task) => isTopLevel(task) && belongsTo(task, list, today))
    .sort(LIST_ORDER[list]);
}

/** "Today" as shown: overdue on top as its own group, then today's tasks. */
export function selectTodayGroups(
  tasks: readonly TaskRead[],
  now: Date,
): { overdue: TaskRead[]; today: TaskRead[] } {
  const today = toLocalDateString(now);
  const open = tasks.filter((task) => isTopLevel(task) && isOpen(task));
  return {
    overdue: open.filter((task) => isOverdue(task, today)).sort(compareByDue),
    today: open.filter((task) => task.due_date === today).sort(compareByPosition),
  };
}

/** "Upcoming" grouped by day, days in order. */
export function groupByDueDate(tasks: readonly TaskRead[]): { date: string; tasks: TaskRead[] }[] {
  const groups = new Map<string, TaskRead[]>();
  for (const task of [...tasks].sort(compareByDue)) {
    const date = task.due_date ?? '';
    const group = groups.get(date);
    if (group) group.push(task);
    else groups.set(date, [task]);
  }
  return [...groups].map(([date, grouped]) => ({ date, tasks: grouped }));
}

/** Incomplete top-level tasks with the tag, in the manual order. */
export function selectTag(tasks: readonly TaskRead[], tag: string): TaskRead[] {
  return tasks
    .filter((task) => isTopLevel(task) && isOpen(task) && task.tags.includes(tag))
    .sort(compareByPosition);
}

/** Badges for the sidebar. */
export function countLists(tasks: readonly TaskRead[], now: Date): Record<SmartList, number> {
  const today = toLocalDateString(now);
  const counts: Record<SmartList, number> = {
    inbox: 0,
    today: 0,
    upcoming: 0,
    overdue: 0,
    completed: 0,
  };
  for (const task of tasks) {
    if (!isTopLevel(task)) continue;
    for (const list of SMART_LISTS) {
      if (belongsTo(task, list, today)) counts[list] += 1;
    }
  }
  return counts;
}

/** Tags of incomplete top-level tasks with counts, alphabetically. */
export function countTags(tasks: readonly TaskRead[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    if (!isTopLevel(task) || !isOpen(task)) continue;
    for (const tag of task.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag, 'ru'));
}
