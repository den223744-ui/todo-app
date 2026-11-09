import { useInertOnExit } from './useInertOnExit';
import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/** Inert during exit: removed controls must leave the keyboard order immediately. */
export function AnimatedListItem({ children, busy }: { children: ReactNode; busy: boolean }) {
  const reduced = useReducedMotion();
  const { ref, present } = useInertOnExit<HTMLLIElement>();
  return (
    <motion.li
      initial={reduced ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={reduced ? {} : { height: 0, opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
      aria-hidden={!present || undefined}
      aria-busy={busy || undefined}
      ref={ref}
      className="flex items-center gap-2 overflow-clip"
    >
      {children}
    </motion.li>
  );
}
