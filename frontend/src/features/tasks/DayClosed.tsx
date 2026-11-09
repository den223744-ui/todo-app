import { motion, useReducedMotion } from 'framer-motion';

import { TEXTS } from '../../constants/texts';

export function DayClosed() {
  const reduced = useReducedMotion();
  return (
    <motion.div
      role="status"
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.22 }}
      className="flex items-start gap-3 rounded-xl border border-line px-4 py-3"
    >
      <svg
        className="mt-0.5 size-6 shrink-0 text-check"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </svg>
      <div>
        <p className="font-display text-lg font-bold">{TEXTS.dayClosed}</p>
        <p className="mt-1 text-sm text-ink-muted">{TEXTS.dayClosedHint}</p>
      </div>
    </motion.div>
  );
}
