import { describe, expect, it } from 'vitest';

import { createQueryClient } from '../../api/queryClient';
import { beginTaskMutation, endTaskMutation, hasPendingTaskMutations } from './pendingMutations';

describe('pending task mutations', () => {
  it('reports the last one to end', () => {
    const client = createQueryClient();
    beginTaskMutation(client);
    beginTaskMutation(client);

    expect(hasPendingTaskMutations(client)).toBe(true);
    expect(endTaskMutation(client)).toBe(false);
    expect(endTaskMutation(client)).toBe(true);
    expect(hasPendingTaskMutations(client)).toBe(false);
  });

  it('is separate per query client and never goes below zero', () => {
    const one = createQueryClient();
    const two = createQueryClient();
    beginTaskMutation(one);

    expect(hasPendingTaskMutations(two)).toBe(false);
    expect(endTaskMutation(two)).toBe(true);
    expect(hasPendingTaskMutations(two)).toBe(false);
    expect(hasPendingTaskMutations(one)).toBe(true);
  });
});
