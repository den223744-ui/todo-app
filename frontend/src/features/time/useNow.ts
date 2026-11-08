/**
 * The current time for date-dependent UI (what is "today", what is overdue).
 * Re-renders at the start of every minute, so a tab left open overnight moves
 * tasks from "Сегодня" to "Просроченные" without a reload.
 */
import { useEffect, useState } from 'react';

const MINUTE = 60_000;

export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      // Align to the next minute boundary instead of drifting by render time.
      timer = setTimeout(
        () => {
          setNow(new Date());
          schedule();
        },
        MINUTE - (Date.now() % MINUTE),
      );
    };
    schedule();
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return now;
}
