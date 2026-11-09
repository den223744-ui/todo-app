import type { TaskRead } from '../api/schema';
import { compareByPosition } from './taskCache';

/** Direct children only, in their manual order. */
export function selectSubtasks(tasks: readonly TaskRead[], parentId: string): TaskRead[] {
  return tasks.filter((task) => task.parent_id === parentId).sort(compareByPosition);
}

export function subtaskProgress(subtasks: readonly TaskRead[]): { done: number; total: number } {
  return {
    done: subtasks.filter((task) => task.completed_at !== null).length,
    total: subtasks.length,
  };
}
