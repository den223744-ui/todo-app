/**
 * Search over title, notes and tags.
 * Case-insensitive, "ё" equals "е", every word of the query must be found
 * (in any field, in any order). An empty query matches everything.
 */
import type { TaskRead } from '../api/schema';
import { compareByDue } from './smartLists';

export function normalizeForSearch(text: string): string {
  return text.toLowerCase().replaceAll('ё', 'е');
}

export function searchWords(query: string): string[] {
  return normalizeForSearch(query).split(/\s+/).filter(Boolean);
}

export function matchesSearch(task: TaskRead, query: string): boolean {
  const words = searchWords(query);
  if (words.length === 0) return true;
  const haystack = normalizeForSearch(
    [task.title, task.notes ?? '', ...task.tags.map((tag) => `#${tag}`)].join('\n'),
  );
  return words.every((word) => haystack.includes(word));
}

export function searchTasks(tasks: readonly TaskRead[], query: string): TaskRead[] {
  return tasks.filter((task) => matchesSearch(task, query));
}

/** Global results: a matching child brings its parent, once, dated tasks first. */
export function searchTopLevelTasks(tasks: readonly TaskRead[], query: string): TaskRead[] {
  const ids = new Set(searchTasks(tasks, query).map((task) => task.parent_id ?? task.id));
  return tasks
    .filter((task) => task.parent_id === null && ids.has(task.id))
    .sort(
      (a, b) => Number(a.due_date === null) - Number(b.due_date === null) || compareByDue(a, b),
    );
}
