import { motion, usePresenceData, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

import { useInertOnExit } from './useInertOnExit';

export function ViewFrame({ children, direction }: { children: ReactNode; direction: number }) {
  const presenceDirection: unknown = usePresenceData();
  if (typeof presenceDirection === 'number') direction = presenceDirection;
  const reduced = useReducedMotion();
  const { ref, present } = useInertOnExit<HTMLDivElement>();
  return (
    <motion.div
      data-view-transition
      aria-hidden={!present || undefined}
      ref={ref}
      initial={reduced ? false : { opacity: 0, x: -direction * 6 }}
      animate={{ opacity: 1, x: 0 }}
      exit={reduced ? {} : { opacity: 0, x: direction * 6 }}
      transition={{ duration: reduced ? 0 : 0.18, ease: 'easeOut' }}
      style={present ? {} : { position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      {children}
    </motion.div>
  );
}
