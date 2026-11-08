import type { TaskCreate } from '../api/schema';
import { toLocalDateString } from './dates';
import {
  parseQuickAdd,
  toTaskCreate,
  type QuickAddResult,
  type QuickAddToken,
  type QuickAddTokenKind,
} from './quickAdd';
import type { View } from './view';

export type QuickAddIssue = 'title-required' | 'title-too-long' | 'too-many-tags' | 'tag-too-long';

// The API's limits (backend/app/schemas/task.py), checked before sending so the
// user gets a specific hint instead of a generic "could not create" error.
export const TITLE_MAX_LENGTH = 500;
export const TAGS_MAX_COUNT = 20;
export const TAG_MAX_LENGTH = 50;

/** Python validates Unicode code points, not UTF-16 code units. */
const codePoints = (text: string) => Array.from(text).length;

export interface PreparedQuickAdd {
  parsed: QuickAddResult;
  task: TaskCreate | null;
  issue: QuickAddIssue | null;
}

/** Explicit input wins; the current view only supplies missing context. */
export function prepareQuickAdd(input: string, view: View, now: Date): PreparedQuickAdd {
  const parsed = parseQuickAdd(input, now);
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
        (view.kind === 'list' && view.list === 'today' ? toLocalDateString(now) : null),
      tags,
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
