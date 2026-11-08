/** Test helper: a complete TaskListRead with sensible defaults. */
import type { TaskListRead } from '../api/schema';

export function makeList(overrides: Partial<TaskListRead> & { id: string }): TaskListRead {
  return {
    name: overrides.id,
    color: 'blue',
    position: 1,
    created_at: '2026-11-08T10:00:00.000Z',
    updated_at: '2026-11-08T10:00:00.000Z',
    ...overrides,
  };
}
