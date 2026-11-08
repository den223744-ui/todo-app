import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';

import { TEXTS } from '../constants/texts';
import { BrandRing } from './BrandRing';

/*
 * The wordmark TOOD with its two O's drawn as task checkboxes: the first one
 * still open, the second one ticked off in the accent colour. A click plays a
 * small wave through the letters and draws the tick again (skipped when the
 * user prefers reduced motion).
 */

const HOP = {
  rest: { y: 0, rotate: 0 },
  play: (index: number) => ({
    y: [0, -4, 1, 0],
    rotate: [0, index % 2 === 0 ? -8 : 8, index % 2 === 0 ? 2 : -2, 0],
    transition: { duration: 0.5, delay: index * 0.05, ease: 'easeOut' as const },
  }),
};

type Glyph = 'T' | 'open' | 'done' | 'D';
const GLYPHS: readonly Glyph[] = ['T', 'open', 'done', 'D'];

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
      className={`inline-flex cursor-pointer items-center gap-[0.06em] rounded-md font-display leading-none text-ink uppercase ${className}`}
    >
      {GLYPHS.map((glyph, index) => (
        <motion.span
          key={glyph}
          aria-hidden="true"
          className="inline-flex"
          custom={index}
          variants={HOP}
          initial="rest"
          animate={controls}
        >
          {glyph === 'T' || glyph === 'D' ? (
            glyph
          ) : (
            <BrandRing done={glyph === 'done'} controls={controls} />
          )}
        </motion.span>
      ))}
    </button>
  );
}
