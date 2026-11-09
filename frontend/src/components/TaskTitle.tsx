import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

export function TaskTitle({
  completed,
  children,
  className = '',
}: {
  completed: boolean;
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.span
      data-task-title
      initial={false}
      animate={{ textDecorationColor: completed ? 'var(--ink-faint)' : 'transparent' }}
      transition={{ duration: reduced ? 0 : 0.18, ease: 'easeOut' }}
      className={`line-through ${completed ? 'text-ink-faint' : ''} ${className}`}
    >
      {children}
    </motion.span>
  );
}
