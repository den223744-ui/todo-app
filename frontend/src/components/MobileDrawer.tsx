import { useEffect, useRef, type ReactNode } from 'react';

import { TEXTS } from '../constants/texts';
import { IconButton } from './IconButton';
import { useFocusTrap } from './useFocusTrap';
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
  const panelRef = useRef<HTMLDivElement>(null);
  // aria-modal promises that the page behind is out of reach: keep Tab inside.
  useFocusTrap(panelRef, true);

  useEffect(() => {
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
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 md:hidden">
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" onClick={onClose} />
      <div
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
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
