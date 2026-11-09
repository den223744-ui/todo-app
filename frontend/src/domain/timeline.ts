/**
 * The day timeline: timed top-level tasks of one day placed on an hour grid.
 *
 * A block lasts the task's duration, SLOT_MINUTES when it has none. Blocks that
 * overlap in time go side by side in lanes (like a calendar); the grid always
 * covers 08:00–22:00 and grows to fit earlier or later tasks.
 */
import type { TaskRead } from '../api/schema';
import { canonicalTime } from './dates';

export const SLOT_MINUTES = 30;
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 22;

export interface TimelineItem {
  task: TaskRead;
  /** Minutes since midnight. */
  start: number;
  end: number;
  /** Column of the block and how many columns its overlap group uses. */
  lane: number;
  lanes: number;
}

export interface TimelineLayout {
  startHour: number;
  /** Exclusive: the last labelled hour line. */
  endHour: number;
  items: TimelineItem[];
  /** Tasks of the day without a time: listed apart, they have no place on the grid. */
  untimed: TaskRead[];
  /** Sum of the durations the day's tasks have (tasks without one count nothing). */
  plannedMinutes: number;
}

export function minutesOf(time: string): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function pixelsToMinutes(pixels: number, pixelsPerHour: number): number {
  return Math.round((pixels * 60) / pixelsPerHour / 15) * 15;
}

export function clampTimelineStart(start: number, duration: number): number {
  return Math.max(0, Math.min(start, 1440 - duration));
}

export function formatTimelineTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function shiftedTime(time: string, duration: number, delta: number): string {
  return canonicalTime(formatTimelineTime(clampTimelineStart(minutesOf(time) + delta, duration)));
}

export function layoutTimeline(tasks: readonly TaskRead[], day: string): TimelineLayout {
  const ofDay = tasks.filter((task) => task.parent_id === null && task.due_date === day);
  const timed = ofDay
    .flatMap((task) => {
      if (task.due_time === null) return [];
      const start = minutesOf(task.due_time);
      const length = task.duration_minutes ?? SLOT_MINUTES;
      return [{ task, start, end: Math.min(start + length, 24 * 60) }];
    })
    .sort((a, b) => a.start - b.start || a.task.position - b.task.position);

  // Group blocks that overlap (directly or through a chain), then give each a lane.
  const items: TimelineItem[] = [];
  let group: TimelineItem[] = [];
  let groupEnd = -1;
  const close = () => {
    const lanes = Math.max(0, ...group.map((item) => item.lane + 1));
    for (const item of group) items.push({ ...item, lanes });
    group = [];
  };
  for (const block of timed) {
    if (block.start >= groupEnd) close();
    const laneEnds: number[] = [];
    for (const item of group) laneEnds[item.lane] = Math.max(laneEnds[item.lane] ?? 0, item.end);
    let lane = laneEnds.findIndex((end) => end <= block.start);
    if (lane === -1) lane = laneEnds.length;
    group.push({ ...block, lane, lanes: 1 });
    groupEnd = Math.max(groupEnd, block.end);
  }
  close();

  const firstHour = Math.min(
    DEFAULT_START_HOUR,
    ...items.map((item) => Math.floor(item.start / 60)),
  );
  const lastHour = Math.max(DEFAULT_END_HOUR, ...items.map((item) => Math.ceil(item.end / 60)));
  return {
    startHour: firstHour,
    endHour: Math.min(lastHour, 24),
    items,
    untimed: ofDay.filter((task) => task.due_time === null),
    plannedMinutes: ofDay.reduce((sum, task) => sum + (task.duration_minutes ?? 0), 0),
  };
}
