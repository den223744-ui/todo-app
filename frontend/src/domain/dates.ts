/**
 * Local calendar helpers. Due dates are plain local dates ('YYYY-MM-DD'), so
 * they compare correctly as strings; "today" is the user's local date of `now`.
 */

const pad = (value: number) => String(value).padStart(2, '0');

/** 'YYYY-MM-DD' of the local calendar day of `date`. */
export function toLocalDateString(date: Date): string {
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** 'HH:MM' of a wall-clock time. */
export function toTimeString(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/**
 * Times in the server's form 'HH:MM:SS'. The API returns '18:00:00' while
 * quick add produces '18:00'; comparing the two as strings would order equal
 * times differently before and after the server answers.
 */
export function canonicalTime(time: string): string {
  return /^\d{2}:\d{2}$/.test(time) ? `${time}:00` : time;
}

/** The local date of a 'YYYY-MM-DD' string, or null when it is not a real calendar day. */
export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

/** 'YYYY-MM-DD' shifted by whole days. */
export function shiftDate(value: string, days: number): string {
  const date = parseLocalDate(value);
  return date ? toLocalDateString(addDays(date, days)) : value;
}
