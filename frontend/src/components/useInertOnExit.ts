import { useIsPresent } from 'framer-motion';
import { useLayoutEffect, useRef } from 'react';

/** Motion's DOM ref may stay attached through exit; update inert in an effect. */
export function useInertOnExit<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const present = useIsPresent();
  useLayoutEffect(() => {
    if (ref.current) ref.current.inert = !present;
  }, [present]);
  return { ref, present };
}
