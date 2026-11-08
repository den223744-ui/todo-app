/**
 * Natural-language quick add: "купить молоко завтра в 18:00 #дом !!"
 * -> title "купить молоко", due tomorrow 18:00, tag "дом", priority 2.
 *
 * Grammar (SPEC.md), case-insensitive, whole words only:
 *   сегодня | завтра | послезавтра
 *   пн…вс | понедельник…воскресенье   (optionally "в"/"во" before: "в пятницу")
 *   через N дней                       (день / дня / дней, N = 1…365)
 *   дд.мм                              (a past date means next year)
 *   в ЧЧ:ММ | в ЧЧ
 *   #тег
 *   ! | !! | !!!                       (priority 1…3)
 *
 * Rules (agreed with the project owner, see SPEC/README):
 * - A weekday equal to today means the same weekday next week.
 * - A time without a date means today if that time is still ahead, else tomorrow.
 * - The first date, time and priority win; repeats stay in the title as text.
 * - Invalid values (31.02, в 25:00, через 0 дней, !!!!) are not tokens.
 *
 * Pure: `now` is passed in; the local calendar of `now` is the user's calendar.
 */
import type { TaskCreate } from '../api/schema';
import { normalizeTag } from './tags';

export type QuickAddTokenKind = 'date' | 'time' | 'tag' | 'priority';

export interface QuickAddToken {
  kind: QuickAddTokenKind;
  /** Range in the input, for highlighting: input.slice(start, end). */
  start: number;
  end: number;
  text: string;
}

export interface QuickAddResult {
  title: string;
  /** YYYY-MM-DD, local calendar. */
  dueDate: string | null;
  /** HH:MM, local wall-clock time. */
  dueTime: string | null;
  tags: string[];
  priority: number;
  /** Recognized parts, in input order. */
  tokens: QuickAddToken[];
}

const MAX_DAYS_AHEAD = 365;

const RELATIVE_DAYS = { сегодня: 0, завтра: 1, послезавтра: 2 } as const;
type RelativeWord = keyof typeof RELATIVE_DAYS;

// JS Date: 0 = Sunday.
const WEEKDAYS = {
  вс: 0,
  воскресенье: 0,
  пн: 1,
  понедельник: 1,
  вт: 2,
  вторник: 2,
  ср: 3,
  среда: 3,
  среду: 3,
  чт: 4,
  четверг: 4,
  пт: 5,
  пятница: 5,
  пятницу: 5,
  сб: 6,
  суббота: 6,
  субботу: 6,
} as const;
type WeekdayWord = keyof typeof WEEKDAYS;

// \b does not know Cyrillic letters, so word boundaries are spelled out.
const WORD_START = String.raw`(?<![\p{L}\p{N}_])`;
const WORD_END = String.raw`(?![\p{L}\p{N}_])`;
const weekdayNames = Object.keys(WEEKDAYS)
  .sort((a, b) => b.length - a.length)
  .join('|');

const PATTERN = new RegExp(
  [
    String.raw`${WORD_START}через\s+(?<inDays>\d{1,3})\s+(?:день|дня|дней)${WORD_END}`,
    String.raw`${WORD_START}(?<relative>сегодня|послезавтра|завтра)${WORD_END}`,
    String.raw`${WORD_START}(?:во?\s+)?(?<weekday>${weekdayNames})${WORD_END}`,
    // Not part of a longer number or of dd.mm.yyyy.
    String.raw`(?<![\p{N}.])(?<day>\d{1,2})\.(?<month>\d{1,2})(?!\d|\.\d)`,
    String.raw`${WORD_START}в\s+(?<hour>\d{1,2})(?::(?<minute>\d{2}))?(?![\p{L}\p{N}_:])`,
    String.raw`(?<=^|\s)#(?<tag>[\p{L}\p{N}_-]+)`,
    String.raw`(?<=^|\s)(?<priority>!{1,3})(?=\s|$)`,
  ].join('|'),
  'giu',
);

export function parseQuickAdd(input: string, now: Date): QuickAddResult {
  const today = startOfDay(now);
  const tokens: QuickAddToken[] = [];
  const tags: string[] = [];
  let date: Date | null = null;
  let time: { hour: number; minute: number } | null = null;
  let priority = 0;

  for (const match of input.matchAll(PATTERN)) {
    // Every alternative has named groups, so `groups` is always set.
    const groups = match.groups as Record<string, string | undefined>;
    const text = match[0];
    const start = match.index;
    const keep = (kind: QuickAddTokenKind) => {
      tokens.push({ kind, start, end: start + text.length, text });
    };

    if (groups.tag !== undefined) {
      const tag = normalizeTag(groups.tag);
      if (!tags.includes(tag)) tags.push(tag);
      keep('tag');
    } else if (groups.priority !== undefined) {
      if (priority === 0) {
        priority = groups.priority.length;
        keep('priority');
      }
    } else if (groups.hour !== undefined) {
      const parsed = parseTime(groups.hour, groups.minute);
      if (time === null && parsed) {
        time = parsed;
        keep('time');
      }
    } else if (date === null) {
      const parsed = parseDate(groups, today);
      if (parsed) {
        date = parsed;
        keep('date');
      }
    }
  }

  if (time !== null && date === null) {
    const ahead = time.hour * 60 + time.minute > now.getHours() * 60 + now.getMinutes();
    date = ahead ? today : addDays(today, 1);
  }

  return {
    title: removeTokens(input, tokens),
    dueDate: date ? formatDate(date) : null,
    dueTime: time ? formatTime(time.hour, time.minute) : null,
    tags,
    priority,
    tokens,
  };
}

/** The create body for a parsed input, or null when nothing is left for a title. */
export function toTaskCreate(result: QuickAddResult): TaskCreate | null {
  if (!result.title) return null;
  return {
    title: result.title,
    due_date: result.dueDate,
    due_time: result.dueTime,
    tags: result.tags,
    priority: result.priority,
  };
}

function parseDate(groups: Record<string, string | undefined>, today: Date): Date | null {
  if (groups.relative !== undefined) {
    // The regex only matches the known words.
    return addDays(today, RELATIVE_DAYS[groups.relative.toLowerCase() as RelativeWord]);
  }
  if (groups.weekday !== undefined) {
    const target = WEEKDAYS[groups.weekday.toLowerCase() as WeekdayWord];
    // Same weekday as today means next week: "сегодня" exists for today.
    const ahead = (target - today.getDay() + 7) % 7 || 7;
    return addDays(today, ahead);
  }
  if (groups.inDays !== undefined) {
    const days = Number(groups.inDays);
    return days >= 1 && days <= MAX_DAYS_AHEAD ? addDays(today, days) : null;
  }
  return parseDayMonth(Number(groups.day), Number(groups.month), today);
}

function parseDayMonth(day: number, month: number, today: Date): Date | null {
  const thisYear = calendarDate(today.getFullYear(), month, day);
  if (thisYear && thisYear >= today) return thisYear;
  return calendarDate(today.getFullYear() + 1, month, day);
}

/** A real calendar date or null (31.02, 00.05, 12.13 are not). */
function calendarDate(year: number, month: number, day: number): Date | null {
  const date = new Date(year, month - 1, day);
  const valid =
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
  return valid ? date : null;
}

function parseTime(hourText: string, minuteText: string | undefined) {
  const hour = Number(hourText);
  const minute = minuteText === undefined ? 0 : Number(minuteText);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

function removeTokens(input: string, tokens: readonly QuickAddToken[]): string {
  let title = '';
  let cursor = 0;
  for (const token of tokens) {
    title += `${input.slice(cursor, token.start)} `;
    cursor = token.end;
  }
  title += input.slice(cursor);
  return title.replace(/\s+/g, ' ').trim();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

const pad = (value: number) => String(value).padStart(2, '0');

function formatDate(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}
