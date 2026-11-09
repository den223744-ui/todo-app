import type { TaskListRead, TaskRead } from '../api/schema';

import { toLocalDateString } from './dates';
import { selectTaskGroups } from './taskGroups';
import type { AppLocation, View } from './view';

const shortDate = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

export interface QuickAddFeedback {
  section: 'inbox' | 'today' | 'upcoming';
  listName: string | null;
  dateLabel: string | null;
  visible: boolean;
  destination: AppLocation;
}

/** Destination and actual visibility after saving, including search and the tomorrow group. */
export function quickAddFeedback(
  task: TaskRead,
  lists: readonly TaskListRead[],
  location: AppLocation,
  now: Date,
): QuickAddFeedback {
  const today = toLocalDateString(now);
  const section = task.due_date === null ? 'inbox' : task.due_date <= today ? 'today' : 'upcoming';
  const openList =
    location.view.kind === 'taskList' && location.view.listId === task.list_id
      ? lists.find((list) => list.id === task.list_id)
      : undefined;
  const view: View = openList
    ? { kind: 'taskList', listId: openList.id }
    : { kind: 'list', list: section };
  return {
    section,
    listName: openList?.name ?? null,
    dateLabel:
      task.due_date !== null && task.due_date !== today
        ? shortDate.format(new Date(`${task.due_date}T00:00:00`))
        : null,
    visible: selectTaskGroups([task], lists, location, now).some((group) =>
      group.tasks.some((shown) => shown.id === task.id),
    ),
    destination: {
      view,
      query: '',
      taskId: task.id,
      // Today itself lists overdue tasks too: no need to open a past day.
      day: null,
    },
  };
}
