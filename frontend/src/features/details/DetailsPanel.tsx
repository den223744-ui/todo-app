import { useEffect, useRef, type ReactNode } from 'react';

import { IconButton } from '../../components/IconButton';
import { CloseIcon } from '../../components/icons/CloseIcon';
import { useFocusTrap } from '../../components/useFocusTrap';
import { useMediaQuery } from '../../components/useMediaQuery';
import { EDIT_TEXTS } from '../../constants/texts';

interface DetailsPanelProps {
  /** Changes when another task opens: focus moves into the panel again. */
  taskKey: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * The detail panel frame: a right column on wide screens, a full-screen sheet
 * on narrow ones. Esc anywhere inside closes it; focus moves in when it opens.
 */
export function DetailsPanel({ taskKey, onClose, children }: DetailsPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  // Below lg the panel covers the page: there it is a modal dialog.
  const modal = useMediaQuery('(max-width: 1023.98px)');
  useFocusTrap(panelRef, modal);

  useEffect(() => {
    headingRef.current?.focus();
  }, [taskKey]);

  // The window narrowed and the panel became a modal over the page: focus
  // left behind on the page moves into it.
  useEffect(() => {
    if (modal && !panelRef.current?.contains(document.activeElement)) {
      headingRef.current?.focus();
    }
  }, [modal]);

  return (
    <aside
      ref={panelRef}
      role={modal ? 'dialog' : undefined}
      aria-modal={modal || undefined}
      aria-labelledby="task-details-heading"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) {
          event.preventDefault();
          onClose();
        }
      }}
      className="fixed inset-0 z-30 flex flex-col bg-surface lg:static lg:z-auto lg:my-4 lg:mr-4 lg:w-[380px] lg:shrink-0 lg:overflow-hidden lg:rounded-2xl lg:border lg:border-line lg:shadow-soft"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2
          id="task-details-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-sm font-semibold outline-none"
        >
          {EDIT_TEXTS.details}
        </h2>
        <IconButton label={EDIT_TEXTS.closeDetails} onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
    </aside>
  );
}
