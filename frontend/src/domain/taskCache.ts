/**
 * Pure updates of the cached task list, used for optimistic UI.
 *
 * They mirror the server rules (backend/app/services/tasks.py) so an optimistic
 * task looks like the final one; the server's answer replaces it afterwards.
 * Time comes in as `now`, never from the clock.
 */
import type { TaskCreate, TaskRead, TaskUpdate } from '../api/schema';

import { canonicalTime } from './dates';
import { normalizeTags } from './tags';

/** Same order as GET /api/tasks: position, then creation time, then id. */
export function compareByPosition(a: TaskRead, b: TaskRead): number {
  return (
    a.position - b.position || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id)
  );
}

/** Position for a task appended to its list (top level or one parent's subtasks). */
export function nextPosition(tasks: readonly TaskRead[], parentId: string | null): number {
  const siblings = tasks.filter((task) => task.parent_id === parentId);
  if (siblings.length === 0) {
    return 1;
  }
  return Math.max(...siblings.map((task) => task.position)) + 1;
}

export function buildOptimisticTask(
  input: TaskCreate,
  id: string,
  tasks: readonly TaskRead[],
  now: Date,
): TaskRead {
  const parentId = input.parent_id ?? null;
  const timestamp = now.toISOString();
  return {
    id,
    parent_id: parentId,
    list_id: input.list_id ?? null,
    title: input.title.trim(),
    notes: input.notes ?? null,
    priority: input.priority ?? 0,
    due_date: input.due_date ?? null,
    due_time: input.due_time ? canonicalTime(input.due_time) : null,
    duration_minutes: input.duration_minutes ?? null,
    tags: normalizeTags(input.tags ?? []),
    position: input.position ?? nextPosition(tasks, parentId),
    completed_at: null,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

/** Insert tasks that are not in the list yet, keeping the list order. */
export function insertTasks(tasks: readonly TaskRead[], added: readonly TaskRead[]): TaskRead[] {
  const present = new Set(tasks.map((task) => task.id));
  const fresh = added.filter((task) => !present.has(task.id));
  return [...tasks, ...fresh].sort(compareByPosition);
}

/** Replace the task with `id` (e.g. an optimistic one by the server's version). */
export function replaceTask(tasks: readonly TaskRead[], id: string, task: TaskRead): TaskRead[] {
  return tasks.map((current) => (current.id === id ? task : current)).sort(compareByPosition);
}

export function removeTasks(tasks: readonly TaskRead[], ids: ReadonlySet<string>): TaskRead[] {
  return tasks.filter((task) => !ids.has(task.id));
}

/** Apply a PATCH body the way the server does. */
export function applyUpdate(task: TaskRead, patch: TaskUpdate, now: Date): TaskRead {
  const next: TaskRead = { ...task };
  if (patch.title !== undefined) next.title = patch.title.trim();
  if (patch.notes !== undefined) next.notes = patch.notes;
  if (patch.priority !== undefined) next.priority = patch.priority;
  if (patch.tags !== undefined) next.tags = normalizeTags(patch.tags);
  if (patch.position !== undefined) next.position = patch.position;
  if (patch.list_id !== undefined) next.list_id = patch.list_id;
  if (patch.duration_minutes !== undefined) next.duration_minutes = patch.duration_minutes;
  if (patch.due_time !== undefined) {
    next.due_time = patch.due_time === null ? null : canonicalTime(patch.due_time);
  }
  if (patch.due_date !== undefined) {
    next.due_date = patch.due_date;
    // A time without a date means nothing: clearing the date clears the time.
    if (patch.due_date === null && patch.due_time === undefined) next.due_time = null;
  }
  if (patch.completed === true && task.completed_at === null) {
    next.completed_at = now.toISOString();
  } else if (patch.completed === false) {
    next.completed_at = null;
  }
  // An empty PATCH changes nothing on the server, updated_at included.
  if (Object.keys(patch).length > 0) {
    next.updated_at = now.toISOString();
  }
  return next;
}

/** Task fields that a PATCH body writes, the way applyUpdate applies it. */
export type TaskField = keyof TaskRead;

export function patchedFields(patch: TaskUpdate): Set<TaskField> {
  const fields = new Set<TaskField>();
  const direct = [
    'title',
    'notes',
    'priority',
    'tags',
    'position',
    'list_id',
    'duration_minutes',
    'due_date',
    'due_time',
  ] as const;
  for (const key of direct) if (patch[key] !== undefined) fields.add(key);
  if (patch.due_date === null) fields.add('due_time'); // clearing the date clears the time
  if (patch.completed !== undefined) fields.add('completed_at');
  return fields;
}

/**
 * Undo one failed PATCH on the task as it is now: the fields that PATCH
 * wrote go back to `previous`, except those in `keep` (written again by a
 * later PATCH still on its way, whose own value must stay). Fields changed
 * by other writes are left alone.
 */
export function revertUpdate(
  task: TaskRead,
  previous: TaskRead,
  patch: TaskUpdate,
  keep: ReadonlySet<TaskField>,
): TaskRead {
  const next: TaskRead = { ...task };
  for (const field of patchedFields(patch)) {
    if (!keep.has(field)) copyField(next, previous, field);
  }
  return next;
}

function copyField<K extends TaskField>(
  target: Pick<TaskRead, K>,
  source: Pick<TaskRead, K>,
  key: K,
): void {
  target[key] = source[key];
}

export function updateTask(
  tasks: readonly TaskRead[],
  id: string,
  patch: TaskUpdate,
  now: Date,
): TaskRead[] {
  const task = tasks.find((current) => current.id === id);
  return task ? replaceTask(tasks, id, applyUpdate(task, patch, now)) : [...tasks];
}

/** Remove a task together with its subtasks, as a server-side delete does. */
export function removeTaskWithSubtasks(
  tasks: readonly TaskRead[],
  id: string,
): { tasks: TaskRead[]; removed: TaskRead[] } {
  const removed = tasks.filter((task) => task.id === id || task.parent_id === id);
  return { tasks: removeTasks(tasks, new Set(removed.map((task) => task.id))), removed };
}
