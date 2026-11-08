import type { TaskListRead, TaskRead } from '../api/schema';
import { searchTasks } from './search';
import { groupByDueDate, selectList, selectTag, selectToday, selectTomorrow } from './smartLists';
import { groupByList, selectInList } from './taskLists';
import type { AppLocation } from './view';

export interface TaskGroup {
  key: string;
  tasks: TaskRead[];
  /** Groups by list: the list, or null for tasks without one. */
  list?: TaskListRead | null;
}

/** Apply search within the selected view; only nonempty groups reach the UI. */
export function selectTaskGroups(
  tasks: readonly TaskRead[],
  lists: readonly TaskListRead[],
  { view, query }: AppLocation,
  now: Date,
): TaskGroup[] {
  const matching = searchTasks(tasks, query);
  if (view.kind === 'list' && view.list === 'today') {
    // Today's tasks by list, then tomorrow's as one group at the very bottom.
    const today: TaskGroup[] = groupByList(selectToday(matching, now), lists).map(
      ({ list, tasks: grouped }) => ({
        key: list ? `list:${list.id}` : 'list:none',
        tasks: grouped,
        list,
      }),
    );
    const tomorrow = selectTomorrow(matching, now);
    return tomorrow.length > 0 ? [...today, { key: 'tomorrow', tasks: tomorrow }] : today;
  }
  const selected =
    view.kind === 'tag'
      ? selectTag(matching, view.tag)
      : view.kind === 'taskList'
        ? selectInList(matching, view.listId)
        : selectList(matching, view.list, now);
  if (view.kind === 'list' && view.list === 'upcoming') {
    return groupByDueDate(selected).map(({ date, tasks: grouped }) => ({
      key: date,
      tasks: grouped,
    }));
  }
  return selected.length > 0 ? [{ key: 'all', tasks: selected }] : [];
}
