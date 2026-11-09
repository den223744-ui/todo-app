import { useRef } from 'react';

import type { TaskRead } from '../../api/schema';
import { UNDO_TEXTS, MOVE_TEXTS } from '../../constants/texts';
import { canonicalTime } from '../../domain/dates';
import { shiftedTime, SLOT_MINUTES } from '../../domain/timeline';
import { useToastStore } from '../../store/toastStore';
import { UNDO_MS } from '../tasks/useTaskActions';
import { useUpdateTask } from '../tasks/useTasks';

interface Series {
  id: string;
  original: string;
  current: string;
  at: number;
  toastId: number | null;
  sequence: number;
}

export function useTimelineMove() {
  const update = useUpdateTask();
  const series = useRef<Series | null>(null);
  const save = (task: TaskRead, time: string, keyboard: boolean) => {
    if (!task.due_time) return;
    const toasts = useToastStore.getState();
    const previous = series.current;
    const continuing =
      keyboard &&
      previous?.id === task.id &&
      Date.now() - previous.at < 800 &&
      toasts.toasts.some((toast) => toast.id === previous.toastId);
    const operation: Series = continuing
      ? previous
      : {
          id: task.id,
          original: canonicalTime(task.due_time),
          current: canonicalTime(task.due_time),
          at: 0,
          toastId: null,
          sequence: 0,
        };
    if (canonicalTime(time) === operation.current) return;
    if (continuing && operation.toastId !== null) toasts.dismissToast(operation.toastId);
    operation.current = time;
    operation.at = Date.now();
    const sequence = ++operation.sequence;
    series.current = operation;
    operation.toastId = toasts.showToast(MOVE_TEXTS.movedTime(time.slice(0, 5)), {
      duration: UNDO_MS,
      action: {
        label: UNDO_TEXTS.undo,
        undo: true,
        run: () => {
          if (series.current === operation) series.current = null;
          update.mutate({ id: task.id, patch: { due_time: operation.original } });
        },
      },
    });
    update.mutate(
      { id: task.id, patch: { due_time: time } },
      {
        onError: () => {
          if (operation.sequence !== sequence) return;
          if (operation.toastId !== null) useToastStore.getState().dismissToast(operation.toastId);
          if (series.current === operation) series.current = null;
        },
      },
    );
  };
  return {
    move: (task: TaskRead, time: string) => {
      save(task, time, false);
    },
    shift: (task: TaskRead, delta: number) => {
      const previous = series.current;
      const base =
        previous?.id === task.id && Date.now() - previous.at < 800
          ? previous.current
          : task.due_time;
      if (base) save(task, shiftedTime(base, task.duration_minutes ?? SLOT_MINUTES, delta), true);
    },
  };
}
