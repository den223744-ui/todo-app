import type { TaskListRead, TaskRead } from '../api/schema';
import { toLocalDateString } from './dates';
import { searchTopLevelTasks } from './search';
import { groupByDueDate, selectDay, selectList, selectTag, selectTomorrow } from './smartLists';
import { groupByList, selectInList } from './taskLists';
import type { AppLocation } from './view';

export interface TaskGroup {
  key: string;
  tasks: TaskRead[];
  /** Groups by list: the list, or null for tasks without one. */
  list?: TaskListRead | null;
}

/** Search spans every view; only nonempty groups reach the UI. */
export function selectTaskGroups(
  tasks: readonly TaskRead[],
  lists: readonly TaskListRead[],
  { view, query, day }: AppLocation,
  now: Date,
): TaskGroup[] {
  if (query.trim()) {
    const matching = searchTopLevelTasks(tasks, query);
    return [
      { key: 'search:open', tasks: matching.filter((task) => task.completed_at === null) },
      { key: 'search:completed', tasks: matching.filter((task) => task.completed_at !== null) },
    ].filter((group) => group.tasks.length > 0);
  }
  if (view.kind === 'list' && view.list === 'today') {
    // The chosen day's tasks by list; for today itself, tomorrow's follow as one group.
    const today = toLocalDateString(now);
    const shown = day ?? today;
    const byList: TaskGroup[] = groupByList(selectDay(tasks, shown, now), lists).map(
      ({ list, tasks: grouped }) => ({
        key: list ? `list:${list.id}` : 'list:none',
        tasks: grouped,
        list,
      }),
    );
    const tomorrow = shown === today ? selectTomorrow(tasks, now) : [];
    return tomorrow.length > 0 ? [...byList, { key: 'tomorrow', tasks: tomorrow }] : byList;
  }
  const selected =
    view.kind === 'tag'
      ? selectTag(tasks, view.tag)
      : view.kind === 'taskList'
        ? selectInList(tasks, view.listId)
        : selectList(tasks, view.list, now);
  if (view.kind === 'list' && view.list === 'upcoming') {
    return groupByDueDate(selected).map(({ date, tasks: grouped }) => ({
      key: date,
      tasks: grouped,
    }));
  }
  return selected.length > 0 ? [{ key: 'all', tasks: selected }] : [];
}
