/**
 * Writes to one task go to the server one at a time, in the order they were
 * made.
 *
 * Two quick edits of the same task (say, adding two tags) are two PATCH
 * requests on possibly different connections; the server may process the
 * second first. Each PATCH carries the whole tags list as it was after the
 * optimistic update, so the late one would win and drop the other tag. A
 * per-task queue keeps the order; writes to different tasks stay parallel.
 *
 * A write that waited in the queue may come up after the network has gone.
 * TanStack pauses a mutation only when it starts offline; this one started
 * online, so the queue itself waits for the connection to come back instead
 * of sending a request that is bound to fail and be rolled back.
 */
import { onlineManager } from '@tanstack/react-query';

const queues = new Map<string, Promise<unknown>>();

function whenOnline(): Promise<void> {
  if (onlineManager.isOnline()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = onlineManager.subscribe((online) => {
      if (!online) return;
      unsubscribe();
      resolve();
    });
  });
}

export function enqueueTaskWrite<T>(taskId: string, write: () => Promise<T>): Promise<T> {
  const previous = queues.get(taskId) ?? Promise.resolve();
  const start = () => whenOnline().then(write);
  // Run after the previous write whatever its outcome: a failure is reported
  // (and rolled back) on its own and must not block the next change.
  const run = previous.then(start, start);
  queues.set(taskId, run);
  const cleanup = () => {
    if (queues.get(taskId) === run) queues.delete(taskId);
  };
  run.then(cleanup, cleanup);
  return run;
}

/** For tests: how many tasks currently have writes in the queue. */
export function queuedTaskCount(): number {
  return queues.size;
}
