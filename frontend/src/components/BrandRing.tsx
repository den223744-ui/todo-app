import { motion, type useAnimationControls } from 'framer-motion';

/** One O of the TOOD wordmark as a checkbox: open, or ticked in the accent colour. */
const TICK = {
  rest: { pathLength: 1 },
  play: {
    pathLength: [0, 1],
    transition: { duration: 0.45, delay: 0.25, ease: 'easeOut' as const },
  },
};

export function BrandRing({
  done,
  controls,
}: {
  done: boolean;
  controls: ReturnType<typeof useAnimationControls>;
}) {
  return (
    <svg className="h-[0.72em] w-[0.72em]" viewBox="0 0 24 24" aria-hidden="true">
      {done ? (
        <>
          <circle cx="12" cy="12" r="11" fill="var(--accent)" />
          <motion.path
            d="M6.8 12.4l3.4 3.4 7-7.4"
            fill="none"
            stroke="var(--accent-fg)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            variants={TICK}
            initial="rest"
            animate={controls}
          />
        </>
      ) : (
        <circle cx="12" cy="12" r="9.6" fill="none" stroke="currentColor" strokeWidth="2.8" />
      )}
    </svg>
  );
}
