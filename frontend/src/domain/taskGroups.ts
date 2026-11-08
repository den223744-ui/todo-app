import type { TaskRead } from '../api/schema';
import { searchTasks } from './search';
import { groupByDueDate, selectList, selectTag, selectTodayGroups } from './smartLists';
import type { AppLocation } from './view';

export interface TaskGroup {
  key: string;
  tasks: TaskRead[];
}

/** Apply search within the selected view; only nonempty groups reach the UI. */
export function selectTaskGroups(
  tasks: readonly TaskRead[],
  { view, query }: AppLocation,
  now: Date,
): TaskGroup[] {
  const matching = searchTasks(tasks, query);
  if (view.kind === 'list' && view.list === 'today') {
    const { overdue, today } = selectTodayGroups(matching, now);
    return [
      { key: 'overdue', tasks: overdue },
      { key: 'today', tasks: today },
    ].filter((group) => group.tasks.length > 0);
  }
  const selected =
    view.kind === 'tag' ? selectTag(matching, view.tag) : selectList(matching, view.list, now);
  if (view.kind === 'list' && view.list === 'upcoming') {
    return groupByDueDate(selected).map(({ date, tasks: grouped }) => ({
      key: date,
      tasks: grouped,
    }));
  }
  return selected.length > 0 ? [{ key: 'all', tasks: selected }] : [];
}
