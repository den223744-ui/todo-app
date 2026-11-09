import { useInertOnExit } from './useInertOnExit';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';

import { TEXTS } from '../constants/texts';
import { IconButton } from './IconButton';
import { useFocusTrap } from './useFocusTrap';
import { useMediaQuery } from './useMediaQuery';
import { CloseIcon } from './icons/CloseIcon';

interface MobileDrawerProps {
  onClose: () => void;
  children: ReactNode;
}

/**
 * The sidebar as a modal drawer on small screens. Esc and a click on the
 * backdrop close it; focus moves into it and returns to where it was.
 */
export function MobileDrawer({ onClose, children }: MobileDrawerProps) {
  const { ref: rootRef, present } = useInertOnExit<HTMLDivElement>();
  const reduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  // aria-modal promises that the page behind is out of reach: keep Tab inside.
  useFocusTrap(panelRef, present);
  // From md up the drawer is hidden by CSS and the sidebar is back in place:
  // close it, or its focus trap would hold Tab on elements nobody can see.
  const wide = useMediaQuery('(min-width: 768px)');
  useEffect(() => {
    if (wide) onClose();
  }, [wide, onClose]);

  useEffect(() => {
    if (!present) return;
    const previouslyFocused = document.activeElement;
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [onClose, present]);

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduced ? {} : { opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.2 }}
      aria-hidden={!present || undefined}
      ref={rootRef}
      className="fixed inset-0 z-40 md:hidden"
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={onClose} />
      <motion.div
        initial={reduced ? false : { x: -288 }}
        animate={{ x: 0 }}
        exit={reduced ? {} : { x: -288 }}
        transition={{ duration: reduced ? 0 : 0.2, ease: 'easeOut' }}
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={TEXTS.navigation}
        tabIndex={-1}
        className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-soft outline-none"
      >
        <div className="flex justify-end p-2">
          <IconButton label={TEXTS.closeMenu} onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">{children}</div>
      </motion.div>
    </motion.div>
  );
}
