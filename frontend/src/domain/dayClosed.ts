import type { TaskRead } from '../api/schema';
import { toLocalDateString } from './dates';
import { selectToday } from './smartLists';
import { progressOf } from './taskLists';
import type { AppLocation } from './view';

/** Celebrate only the real, unfiltered Today, using the same tasks as its progress ring. */
export function isDayClosed(tasks: readonly TaskRead[], location: AppLocation, now: Date): boolean {
  if (
    location.view.kind !== 'list' ||
    location.view.list !== 'today' ||
    location.query.trim() ||
    (location.day != null && location.day !== toLocalDateString(now))
  )
    return false;
  const shown = selectToday(tasks, now);
  const { done, total } = progressOf(shown, tasks);
  return total > 0 && done === total;
}
