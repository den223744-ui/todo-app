/**
 * The API's validation limits (backend/app/schemas/task.py), checked on the
 * client so the user gets a specific hint instead of a generic server error.
 */
export const TITLE_MAX_LENGTH = 500;
export const NOTES_MAX_LENGTH = 10_000;
export const TAGS_MAX_COUNT = 20;
export const TAG_MAX_LENGTH = 50;

/** Length as Python counts it: Unicode code points, not UTF-16 code units. */
export function codePoints(text: string): number {
  return Array.from(text).length;
}
