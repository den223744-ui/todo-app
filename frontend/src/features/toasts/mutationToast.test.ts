import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/client';
import { TOAST_TEXTS } from '../../constants/texts';
import { mutationErrorToast } from './mutationToast';

const SERVER = new ApiError(500, 'internal_error', 'boom');

describe('mutationErrorToast', () => {
  it.each([
    ['update', { id: 't', patch: {} }, TOAST_TEXTS.updateFailed],
    ['delete', 't', TOAST_TEXTS.deleteFailed],
    ['restore', { id: 't' }, TOAST_TEXTS.restoreFailed],
  ] as const)('%s failure', (kind, variables, expected) => {
    expect(mutationErrorToast({ kind }, variables, SERVER)).toBe(expected);
  });

  it('names the task that could not be created', () => {
    expect(mutationErrorToast({ kind: 'create' }, { title: 'Купить хлеб' }, SERVER)).toBe(
      TOAST_TEXTS.createFailed('Купить хлеб'),
    );
    expect(mutationErrorToast({ kind: 'create' }, undefined, SERVER)).toBe(
      TOAST_TEXTS.createFailed(''),
    );
  });

  it('names the list that could not be created, or says the name is taken', () => {
    expect(mutationErrorToast({ kind: 'createList' }, { name: 'Дом' }, SERVER)).toBe(
      TOAST_TEXTS.createListFailed('Дом'),
    );
    expect(mutationErrorToast({ kind: 'createList' }, undefined, SERVER)).toBe(
      TOAST_TEXTS.createListFailed(''),
    );
    expect(
      mutationErrorToast(
        { kind: 'createList' },
        { name: 'Дом' },
        new ApiError(409, 'conflict', 'taken'),
      ),
    ).toBe(TOAST_TEXTS.listNameTaken);
  });

  it('says so when the network is down, whatever the operation', () => {
    const offline = new ApiError(0, 'network_error', 'offline');
    expect(mutationErrorToast({ kind: 'update' }, {}, offline)).toBe(TOAST_TEXTS.offline);
  });

  it('stays quiet for mutations that are not task writes', () => {
    expect(mutationErrorToast(undefined, {}, SERVER)).toBeNull();
    expect(mutationErrorToast({}, {}, SERVER)).toBeNull();
  });
});
