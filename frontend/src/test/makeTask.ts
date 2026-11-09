/** Test helper: a complete TaskRead with sensible defaults. */
import type { TaskRead } from '../api/schema';

export function makeTask(overrides: Partial<TaskRead> & { id: string }): TaskRead {
  return {
    parent_id: null,
    list_id: null,
    title: overrides.id,
    notes: null,
    priority: 0,
    due_date: null,
    due_time: null,
    duration_minutes: null,
    tags: [],
    position: 1,
    completed_at: null,
    created_at: '2026-11-08T10:00:00.000Z',
    updated_at: '2026-11-08T10:00:00.000Z',
    ...overrides,
  };
}
