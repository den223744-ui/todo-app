import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';

import { TEXTS } from '../constants/texts';

const LETTER = {
  rest: { y: 0, rotate: 0 },
  play: (index: number) => ({
    y: [0, -5, 1.5, 0],
    rotate: [0, index % 2 === 0 ? -9 : 9, index % 2 === 0 ? 3 : -3, 0],
    transition: { duration: 0.55, delay: index * 0.05, ease: 'easeOut' as const },
  }),
};

/** The wordmark; a click makes its letters hop in a little wave (not with reduced motion). */
export function BrandLogo({ className = '' }: { className?: string }) {
  const controls = useAnimationControls();
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      aria-label={TEXTS.brand}
      onClick={() => {
        if (!reduceMotion) void controls.start('play');
      }}
      className={`inline-flex cursor-pointer rounded-md font-display font-extrabold tracking-[0.3em] text-ink uppercase ${className}`}
    >
      {Array.from(TEXTS.brand).map((letter, index) => (
        <motion.span
          // The letters never reorder: the index is a stable key.
          key={index}
          aria-hidden="true"
          className="inline-block"
          custom={index}
          variants={LETTER}
          initial="rest"
          animate={controls}
        >
          {letter}
        </motion.span>
      ))}
    </button>
  );
}
