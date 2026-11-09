import { TEXTS } from '../constants/texts';
import { addDays, toLocalDateString } from './dates';

/** Calendar arithmetic also works across DST and year boundaries. */
export function dayHeading(day: string, now: Date): string {
  if (day === toLocalDateString(addDays(now, 1))) return TEXTS.tomorrow;
  if (day === toLocalDateString(addDays(now, 2))) return TEXTS.dayAfterTomorrow;
  const date = new Date(`${day}T00:00:00`);
  const label = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
