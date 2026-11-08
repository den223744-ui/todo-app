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
