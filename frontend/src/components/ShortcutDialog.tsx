import { useInertOnExit } from './useInertOnExit';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from './useFocusTrap';
import { IconButton } from './IconButton';
import { CloseIcon } from './icons/CloseIcon';
import { D_TEXTS } from '../constants/texts';

export function ShortcutDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { ref: rootRef, present } = useInertOnExit<HTMLDivElement>();
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useFocusTrap(ref, present);
  useEffect(() => {
    if (!present) return;
    const previous = document.activeElement;
    (ref.current?.querySelector<HTMLElement>('input') ?? ref.current)?.focus();
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [present]);
  return createPortal(
    <motion.div
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduced ? {} : { opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
      aria-hidden={!present || undefined}
      ref={rootRef}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 pt-[10dvh] pb-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={reduced ? false : { y: 6 }}
        animate={{ y: 0 }}
        exit={reduced ? {} : { y: 6 }}
        transition={{ duration: reduced ? 0 : 0.18, ease: 'easeOut' }}
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            onClose();
          }
        }}
        className="w-full max-w-xl rounded-2xl border border-line bg-surface shadow-soft"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
          <h2 id={id} className="font-display text-xl font-bold">
            {title}
          </h2>
          <IconButton label={D_TEXTS.close} onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}
