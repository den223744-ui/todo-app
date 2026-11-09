import { motion, useReducedMotion } from 'framer-motion';
import type { InputHTMLAttributes } from 'react';

/** The native input owns semantics and focus; the SVG is decorative. */
export function TaskCheckbox({
  className = '',
  checked,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const reduced = useReducedMotion();
  return (
    <span className={`relative inline-flex size-4 shrink-0 ${className}`}>
      <input
        {...props}
        type="checkbox"
        checked={checked}
        className="task-checkbox peer absolute inset-0 size-full cursor-pointer appearance-none rounded-[3px] border border-ink-faint checked:border-check checked:bg-check aria-disabled:cursor-wait"
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="pointer-events-none relative size-full text-surface"
      >
        <motion.path
          d="m3.5 8 3 3 6-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: reduced ? 0 : 0.18, ease: 'easeOut' }}
        />
      </svg>
    </span>
  );
}
