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
