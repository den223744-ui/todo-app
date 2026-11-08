import { onlineManager } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';

import { enqueueTaskWrite, queuedTaskCount } from './writeQueue';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('enqueueTaskWrite', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('runs writes to one task strictly in order', async () => {
    const first = deferred<string>();
    const started: string[] = [];
    const a = enqueueTaskWrite('t', () => {
      started.push('first');
      return first.promise;
    });
    const b = enqueueTaskWrite('t', () => {
      started.push('second');
      return Promise.resolve('second');
    });
    await flush();
    expect(started).toEqual(['first']); // the second waits

    first.resolve('first');
    await expect(a).resolves.toBe('first');
    await expect(b).resolves.toBe('second');
    expect(started).toEqual(['first', 'second']);
  });

  it('keeps going after a failed write', async () => {
    const failing = enqueueTaskWrite('t', () => Promise.reject(new Error('boom')));
    const next = enqueueTaskWrite('t', () => Promise.resolve('ok'));

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });

  it('lets writes to different tasks run in parallel', async () => {
    const slow = deferred<string>();
    const started: string[] = [];
    void enqueueTaskWrite('a', () => {
      started.push('a');
      return slow.promise;
    });
    void enqueueTaskWrite('b', () => {
      started.push('b');
      return Promise.resolve('b');
    });
    await flush();

    expect(started).toEqual(['a', 'b']);
    slow.resolve('a');
  });

  it('holds a queued write while offline and sends it on reconnect', async () => {
    const first = deferred<string>();
    const started: string[] = [];
    void enqueueTaskWrite('net', () => {
      started.push('first');
      return first.promise;
    });
    const second = enqueueTaskWrite('net', () => {
      started.push('second');
      return Promise.resolve('second');
    });
    await flush();

    onlineManager.setOnline(false); // the network goes while the first is out
    first.resolve('first');
    await flush();
    expect(started).toEqual(['first']); // the second is not sent into the void

    onlineManager.setOnline(true);
    await expect(second).resolves.toBe('second');
    expect(started).toEqual(['first', 'second']);
  });

  it('forgets a task once its queue is empty', async () => {
    await enqueueTaskWrite('gone', () => Promise.resolve(1));
    await flush();

    expect(queuedTaskCount()).toBe(0);
  });
});
