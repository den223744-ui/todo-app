import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';

import { TEXTS } from '../constants/texts';

const LETTER = {
  rest: { opacity: 1 },
  play: (index: number) => ({
    opacity: [1, 0.65, 1],
    transition: { duration: 0.16, delay: index * 0.02, ease: 'easeOut' as const },
  }),
};

/** The wordmark; a click softly fades its letters in a short wave (not with reduced motion). */
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
