import type { TaskRead, TaskUpdate } from '../api/schema';

/** Text editors use Esc; restore only the properties changed by this operation. */
export function undoPatch(task: TaskRead, patch: TaskUpdate): TaskUpdate {
  const previous: TaskUpdate = {
    completed: task.completed_at !== null,
    due_date: task.due_date,
    due_time: task.due_time,
    duration_minutes: task.duration_minutes,
    list_id: task.list_id,
    priority: task.priority,
    tags: task.tags,
  };
  const fields = Object.keys(patch);
  // Clearing a date also clears its time on the server.
  if ('due_date' in patch) fields.push('due_time');
  return Object.fromEntries(
    fields.filter((key) => key in previous).map((key) => [key, previous[key as keyof TaskUpdate]]),
  );
}
