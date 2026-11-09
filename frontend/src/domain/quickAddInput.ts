import type { TaskCreate, TaskListRead } from '../api/schema';
import { toLocalDateString } from './dates';
import { TAGS_MAX_COUNT, TAG_MAX_LENGTH, TITLE_MAX_LENGTH, codePoints } from './limits';
import {
  parseQuickAdd,
  toTaskCreate,
  type QuickAddResult,
  type QuickAddToken,
  type QuickAddTokenKind,
} from './quickAdd';
import type { View } from './view';

export type QuickAddIssue = 'title-required' | 'title-too-long' | 'too-many-tags' | 'tag-too-long';

export interface PreparedQuickAdd {
  parsed: QuickAddResult;
  task: TaskCreate | null;
  issue: QuickAddIssue | null;
}

/** Explicit input wins; the current view only supplies missing context. */
export function prepareQuickAdd(
  input: string,
  view: View,
  now: Date,
  /** The day the Today screen shows, when not today. */
  day: string | null = null,
  lists: readonly TaskListRead[] = [],
  /** Undefined: use the token/view; null: explicitly picked "no list". */
  explicitListId?: string | null,
): PreparedQuickAdd {
  const parsed = parseQuickAdd(input, now, lists);
  const task = toTaskCreate(parsed);
  if (!task) return { parsed, task: null, issue: 'title-required' };
  if (codePoints(parsed.title) > TITLE_MAX_LENGTH) {
    return { parsed, task: null, issue: 'title-too-long' };
  }
  const tags = view.kind === 'tag' ? [...new Set([...parsed.tags, view.tag])] : parsed.tags;
  if (tags.some((tag) => codePoints(tag) > TAG_MAX_LENGTH)) {
    return { parsed, task: null, issue: 'tag-too-long' };
  }
  if (tags.length > TAGS_MAX_COUNT) return { parsed, task: null, issue: 'too-many-tags' };
  return {
    parsed,
    task: {
      ...task,
      due_date:
        parsed.dueDate ??
        (view.kind === 'list' && view.list === 'today' ? (day ?? toLocalDateString(now)) : null),
      tags,
      // Typed into one of the user's lists: the task goes into that list.
      ...(parsed.listId === null && view.kind === 'taskList' ? { list_id: view.listId } : {}),
      ...(explicitListId === null
        ? { list_id: null }
        : explicitListId !== undefined && lists.some((list) => list.id === explicitListId)
          ? { list_id: explicitListId }
          : {}),
    },
    issue: null,
  };
}

export interface QuickAddSegment {
  text: string;
  kind: QuickAddTokenKind | null;
}

/** Literal text only: no HTML interpretation, whitespace and ranges stay intact. */
export function quickAddSegments(
  input: string,
  tokens: readonly QuickAddToken[],
): QuickAddSegment[] {
  const segments: QuickAddSegment[] = [];
  let cursor = 0;
  for (const token of tokens) {
    if (cursor < token.start) segments.push({ text: input.slice(cursor, token.start), kind: null });
    segments.push({ text: input.slice(token.start, token.end), kind: token.kind });
    cursor = token.end;
  }
  if (cursor < input.length) segments.push({ text: input.slice(cursor), kind: null });
  return segments;
}
