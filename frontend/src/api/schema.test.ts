/**
 * Compile-time checks of the generated API types (tsc runs them; vitest only
 * reports the file). If the backend contract drifts in a way the UI relies on,
 * `npm run typecheck` fails here instead of somewhere deep in a component.
 */
import { describe, expectTypeOf, it } from 'vitest';

import type { ErrorResponse, TaskCreate, TaskRead, TaskUpdate, paths } from './schema';

describe('generated API types', () => {
  it('TaskRead has every field, nullable ones explicitly', () => {
    expectTypeOf<TaskRead['id']>().toEqualTypeOf<string>();
    expectTypeOf<TaskRead['title']>().toEqualTypeOf<string>();
    expectTypeOf<TaskRead['tags']>().toEqualTypeOf<string[]>();
    expectTypeOf<TaskRead['position']>().toEqualTypeOf<number>();
    expectTypeOf<TaskRead['parent_id']>().toEqualTypeOf<string | null>();
    expectTypeOf<TaskRead['due_date']>().toEqualTypeOf<string | null>();
    expectTypeOf<TaskRead['completed_at']>().toEqualTypeOf<string | null>();
  });

  it('TaskUpdate allows null only where the server accepts it', () => {
    expectTypeOf<TaskUpdate['title']>().toEqualTypeOf<string | undefined>();
    expectTypeOf<TaskUpdate['completed']>().toEqualTypeOf<boolean | undefined>();
    expectTypeOf<TaskUpdate['position']>().toEqualTypeOf<number | undefined>();
    expectTypeOf<TaskUpdate['notes']>().toEqualTypeOf<string | null | undefined>();
    expectTypeOf<TaskUpdate['due_date']>().toEqualTypeOf<string | null | undefined>();
  });

  it('TaskCreate requires only a title', () => {
    expectTypeOf<{ title: string }>().toExtend<TaskCreate>();
  });

  it('errors share one shape', () => {
    expectTypeOf<ErrorResponse>().toEqualTypeOf<{ error: { code: string; message: string } }>();
    type PatchErrors = paths['/api/tasks/{task_id}']['patch']['responses'];
    expectTypeOf<PatchErrors[404]['content']['application/json']>().toEqualTypeOf<ErrorResponse>();
  });
});
