import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useEffect, useId, useLayoutEffect, useRef } from 'react';

import type { TaskListRead, TaskRead } from '../../api/schema';
import { TIMELINE_TEXTS, durationLabel, DRAG_TEXTS } from '../../constants/texts';
import { parseLocalDate } from '../../domain/dates';
import { layoutTimeline, pixelsToMinutes, shiftedTime, SLOT_MINUTES } from '../../domain/timeline';
import { useUiStore } from '../../store/uiStore';

import { TimelineBlock } from './TimelineBlock';

interface TimelineProps {
  ready?: boolean;
  onMove?: (task: TaskRead, time: string) => void;
  onShift?: (task: TaskRead, delta: number) => void;
  tasks: readonly TaskRead[];
  lists: readonly TaskListRead[];
  /** The day shown, 'YYYY-MM-DD'. */
  day: string;
  today: string;
  now: Date;
  onOpen: (taskId: string) => void;
  /** The timeline icon badge on top; off where a tab above already names it. */
  showLabel?: boolean;
}

/** Pixels per hour on the grid. */
const HOUR = 56;

const dayFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const pad = (value: number) => String(value).padStart(2, '0');
const clock = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/**
 * The day as a schedule, as in the mockup: an hour grid with the timed tasks
 * as blocks (coloured by their list), a "now" line on today, and the tasks
 * without a time listed underneath. A block opens the task.
 */
export function Timeline({
  tasks,
  lists,
  day,
  today,
  now,
  onOpen,
  showLabel = true,
  onMove,
  onShift,
  ready = true,
}: TimelineProps) {
  const instructionsId = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const positionedDay = useRef<string | null>(null);
  const setDragging = useUiStore((state) => state.setDragging);
  useEffect(
    () => () => {
      setDragging(false);
    },
    [setDragging],
  );
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 230, tolerance: 6 } }),
  );
  const layout = layoutTimeline(tasks, day);
  const byId = new Map(lists.map((list) => [list.id, list]));
  // Full-day scrollable bounds let a drag reach midnight without changing its origin.
  const initialHour = layout.startHour;
  useLayoutEffect(() => {
    if (positionedDay.current === day) return;
    if (viewport.current) viewport.current.scrollTop = initialHour * HOUR;
    if (ready) positionedDay.current = day;
  }, [day, ready, initialHour]);
  const hours = Array.from({ length: 25 }, (_, index) => index);
  const top = (minutes: number) => (minutes / 60) * HOUR;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNow =
    day === today && nowMinutes >= layout.startHour * 60 && nowMinutes <= layout.endHour * 60;
  const date = parseLocalDate(day);
  const count = layout.items.length + layout.untimed.length;

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        announcements: {
          onDragStart: () => DRAG_TEXTS.timelineInstructions,
          onDragEnd: () => '',
          onDragOver: () => '',
          onDragCancel: () => DRAG_TEXTS.dragCancel,
        },
        screenReaderInstructions: { draggable: DRAG_TEXTS.timelineInstructions },
      }}
      onDragStart={() => {
        setDragging(true);
      }}
      onDragCancel={() => {
        setDragging(false);
      }}
      onDragEnd={({ active, delta }) => {
        setDragging(false);
        const task = tasks.find((task) => task.id === active.id);
        if (task?.due_time)
          onMove?.(
            task,
            shiftedTime(
              task.due_time,
              task.duration_minutes ?? SLOT_MINUTES,
              pixelsToMinutes(delta.y, HOUR),
            ),
          );
      }}
    >
      <section aria-label={TIMELINE_TEXTS.region} className="flex min-h-0 flex-1 flex-col">
        <p id={instructionsId} className="sr-only">
          {DRAG_TEXTS.timelineInstructions}
        </p>
        {showLabel && (
          <div className="px-4 pt-4">
            <div className="inline-flex items-center rounded-xl border border-line px-3 py-1.5 text-ink">
              <svg
                className="size-4"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M3 3v10M7 5v6M11 4v8M14 6v4" />
              </svg>
            </div>
          </div>
        )}
        <div className="flex items-baseline justify-between px-4 pt-4 pb-3">
          <h2 className="font-display text-base font-bold text-ink first-letter:uppercase">
            {day === today ? `${TIMELINE_TEXTS.today} · ` : ''}
            {date ? dayFormat.format(date) : day}
          </h2>
          <span className="text-xs text-ink-muted">
            {layout.plannedMinutes > 0
              ? TIMELINE_TEXTS.planned(durationLabel(layout.plannedMinutes))
              : TIMELINE_TEXTS.count(count)}
          </span>
        </div>

        <div
          ref={viewport}
          data-timeline-scroll
          className="min-h-0 max-h-[65dvh] flex-1 overflow-y-auto px-4 pt-2 pb-4 [scrollbar-width:thin]"
        >
          <div className="relative" style={{ height: 24 * HOUR }}>
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute right-0 left-0 flex items-start gap-2"
                style={{ top: hour * HOUR }}
              >
                <span className="-mt-2 w-11 shrink-0 text-[11px] text-ink-faint tabular-nums">
                  {pad(hour)}:00
                </span>
                <span className="mt-0 h-px flex-1 bg-line" aria-hidden="true" />
              </div>
            ))}

            <ol className="absolute top-0 right-0 bottom-0 left-12">
              {layout.items.map((item) => (
                <TimelineBlock
                  key={item.task.id}
                  item={item}
                  list={item.task.list_id ? byId.get(item.task.list_id) : undefined}
                  startHour={0}
                  hourHeight={HOUR}
                  instructionsId={instructionsId}
                  onOpen={onOpen}
                  onShift={onShift}
                  enabled={Boolean(onMove)}
                />
              ))}
            </ol>

            {showNow && (
              <div
                className="pointer-events-none absolute right-0 left-0 flex items-center"
                style={{ top: top(nowMinutes) }}
              >
                <span className="-translate-y-1/2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-fg tabular-nums">
                  <span className="sr-only">{TIMELINE_TEXTS.now} </span>
                  {clock(nowMinutes)}
                </span>
                <span className="h-px flex-1 -translate-y-1/2 bg-accent" aria-hidden="true" />
              </div>
            )}
          </div>

          {layout.items.length === 0 && (
            <p className="mt-4 text-center text-xs text-ink-muted">{TIMELINE_TEXTS.empty}</p>
          )}
          {layout.untimed.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-xs text-ink-faint">{TIMELINE_TEXTS.untimed}</h3>
              <ul className="flex flex-col gap-1.5">
                {layout.untimed.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      data-timeline-task={task.id}
                      onClick={() => {
                        onOpen(task.id);
                      }}
                      className={`w-full truncate rounded-lg border border-line px-2.5 py-1.5 text-left text-xs text-ink hover:bg-subtle ${task.completed_at ? 'line-through' : ''}`}
                    >
                      {task.title}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </DndContext>
  );
}
