import { describe, expect, it } from 'vitest';

import { ApiError } from './client';
import { createQueryClient, shouldRetryQuery } from './queryClient';

describe('shouldRetryQuery', () => {
  it.each([
    [0, new ApiError(0, 'network_error', 'offline'), true],
    [1, new ApiError(503, 'unavailable', 'down'), true],
    [2, new ApiError(503, 'unavailable', 'down'), false],
    [0, new ApiError(404, 'not_found', 'gone'), false],
    [0, new ApiError(422, 'validation_error', 'bad'), false],
    [0, new Error('unexpected'), true],
  ])('attempt %i after %o -> %s', (failureCount, error, expected) => {
    expect(shouldRetryQuery(failureCount, error)).toBe(expected);
  });
});

describe('createQueryClient', () => {
  it('never retries mutations', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(false);
  });
});
