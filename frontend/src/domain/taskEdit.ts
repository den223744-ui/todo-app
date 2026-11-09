/**
 * Turning a field edit in the UI into a PATCH body — or into nothing, when the
 * value did not really change, or into an issue the user must fix first.
 *
 * Mirrors the server rules (backend/app/schemas/task.py) so a save that would
 * be rejected is not sent, and an edit that changes nothing sends no request.
 */
import type { TaskRead, TaskUpdate } from '../api/schema';

import { canonicalTime } from './dates';
import {
  NOTES_MAX_LENGTH,
  TAGS_MAX_COUNT,
  TAG_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  codePoints,
} from './limits';
import { normalizeTag } from './tags';

export type EditIssue =
  | 'title-required'
  | 'title-too-long'
  | 'notes-too-long'
  | 'tag-too-long'
  | 'too-many-tags'
  | 'time-needs-date';

export type EditResult =
  | { kind: 'unchanged' }
  | { kind: 'invalid'; issue: EditIssue }
  | { kind: 'patch'; patch: TaskUpdate };

const UNCHANGED: EditResult = { kind: 'unchanged' };
const invalid = (issue: EditIssue): EditResult => ({ kind: 'invalid', issue });
const patch = (body: TaskUpdate): EditResult => ({ kind: 'patch', patch: body });

/** The title is trimmed like on the server; empty is not allowed. */
export function editTitle(task: TaskRead, input: string): EditResult {
  const title = input.trim();
  if (!title) return invalid('title-required');
  if (codePoints(title) > TITLE_MAX_LENGTH) return invalid('title-too-long');
  return title === task.title ? UNCHANGED : patch({ title });
}

/** Blank notes are stored as no notes. */
export function editNotes(task: TaskRead, input: string): EditResult {
  const notes = input.trim() ? input : null;
  if (notes !== null && codePoints(notes) > NOTES_MAX_LENGTH) return invalid('notes-too-long');
  return notes === task.notes ? UNCHANGED : patch({ notes });
}

export function editPriority(task: TaskRead, priority: number): EditResult {
  return priority === task.priority ? UNCHANGED : patch({ priority });
}

/** '' (a cleared date input) removes the date; the server then drops the time too. */
export function editDueDate(task: TaskRead, input: string): EditResult {
  const dueDate = input || null;
  return dueDate === task.due_date ? UNCHANGED : patch({ due_date: dueDate });
}

/** A time only makes sense with a date; compared in the server's HH:MM:SS form. */
export function editDueTime(task: TaskRead, input: string): EditResult {
  const dueTime = input ? canonicalTime(input) : null;
  if (dueTime !== null && task.due_date === null) return invalid('time-needs-date');
  return dueTime === task.due_time ? UNCHANGED : patch({ due_time: dueTime });
}

export function addTag(task: TaskRead, input: string): EditResult {
  const tag = normalizeTag(input);
  if (!tag || task.tags.includes(tag)) return UNCHANGED;
  if (codePoints(tag) > TAG_MAX_LENGTH) return invalid('tag-too-long');
  if (task.tags.length >= TAGS_MAX_COUNT) return invalid('too-many-tags');
  return patch({ tags: [...task.tags, tag] });
}

export function removeTag(task: TaskRead, tag: string): EditResult {
  return task.tags.includes(tag) ? patch({ tags: task.tags.filter((t) => t !== tag) }) : UNCHANGED;
}

/** Subtasks of a task, in their own manual order. */
export function subtasksOf(tasks: readonly TaskRead[], parentId: string): TaskRead[] {
  return tasks
    .filter((task) => task.parent_id === parentId)
    .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}
