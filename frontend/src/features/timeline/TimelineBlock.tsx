import { useDraggable } from '@dnd-kit/core';

import type { TaskListRead, TaskRead } from '../../api/schema';
import { durationLabel, DRAG_TEXTS } from '../../constants/texts';
import {
  clampTimelineStart,
  formatTimelineTime,
  pixelsToMinutes,
  SLOT_MINUTES,
} from '../../domain/timeline';
import type { TimelineItem } from '../../domain/timeline';

interface Props {
  item: TimelineItem;
  list: TaskListRead | undefined;
  startHour: number;
  hourHeight: number;
  instructionsId: string;
  onOpen: (id: string) => void;
  onShift: ((task: TaskRead, delta: number) => void) | undefined;
  enabled: boolean;
}

export function TimelineBlock({
  item,
  list,
  startHour,
  hourHeight,
  instructionsId,
  onOpen,
  onShift,
  enabled,
}: Props) {
  const { task, start, end, lane, lanes } = item;
  const drag = useDraggable({ id: task.id, disabled: !enabled, data: { task } });
  const duration = task.duration_minutes ?? SLOT_MINUTES;
  const preview = clampTimelineStart(
    start + pixelsToMinutes(drag.transform?.y ?? 0, hourHeight),
    duration,
  );
  const done = task.completed_at !== null;
  return (
    <li
      ref={drag.setNodeRef}
      className="absolute px-0.5"
      style={{
        top: ((start - startHour * 60) / 60) * hourHeight + 2,
        height: Math.max(((end - start) / 60) * hourHeight - 4, 20),
        left: `${String((lane / lanes) * 100)}%`,
        width: `${String(100 / lanes)}%`,
        transform: drag.isDragging
          ? `translateY(${String(((preview - start) / 60) * hourHeight)}px)`
          : undefined,
        zIndex: drag.isDragging ? 10 : undefined,
      }}
    >
      <button
        type="button"
        ref={drag.setActivatorNodeRef}
        {...drag.attributes}
        {...drag.listeners}
        data-timeline-task={task.id}
        data-shortcut-arrows
        aria-describedby={instructionsId}
        aria-roledescription={DRAG_TEXTS.draggable}
        onKeyDown={(event) => {
          if (
            !onShift ||
            event.altKey ||
            event.ctrlKey ||
            event.metaKey ||
            event.nativeEvent.isComposing ||
            (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          onShift(task, (event.key === 'ArrowUp' ? -1 : 1) * (event.shiftKey ? 60 : 15));
        }}
        onClick={() => {
          if (!drag.isDragging) onOpen(task.id);
        }}
        className={`flex h-full w-full items-center justify-between gap-2 rounded-lg border px-2.5 text-left text-xs ${done ? 'text-ink-muted' : ''} ${drag.isDragging ? 'shadow-soft' : ''}`}
        style={{
          borderColor: list ? `var(--list-${list.color})` : 'var(--line)',
          color: list ? `var(--list-${list.color}-ink)` : 'var(--ink)',
          backgroundColor: drag.isDragging ? 'var(--surface)' : undefined,
        }}
      >
        <span className={`truncate font-medium ${done ? 'line-through' : ''}`}>{task.title}</span>
        <span className="shrink-0 tabular-nums" aria-live={drag.isDragging ? 'polite' : 'off'}>
          {drag.isDragging ? (
            `${formatTimelineTime(preview)}–${formatTimelineTime(preview + duration)}`
          ) : (
            <>
              <span className="sr-only">{formatTimelineTime(start)}, </span>
              {durationLabel(end - start)}
            </>
          )}
        </span>
      </button>
    </li>
  );
}
