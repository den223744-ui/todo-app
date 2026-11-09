import { useInertOnExit } from '../../components/useInertOnExit';
import { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

import { IconButton } from '../../components/IconButton';
import { CloseIcon } from '../../components/icons/CloseIcon';
import { TOAST_TEXTS } from '../../constants/texts';
import { DEFAULT_TOAST_DURATION_MS, useToastStore, type Toast } from '../../store/toastStore';

/** How long a toast stays; it can always be closed earlier. */
export const TOAST_DURATION_MS = DEFAULT_TOAST_DURATION_MS;

export function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismissToast);
  const duration = toast.duration ?? TOAST_DURATION_MS;
  const reduced = useReducedMotion();
  const { ref, present } = useInertOnExit<HTMLDivElement>();

  useEffect(() => {
    const timer = setTimeout(
      () => {
        dismiss(toast.id);
      },
      toast.expiresAt === undefined ? duration : Math.max(0, toast.expiresAt - Date.now()),
    );
    return () => {
      clearTimeout(timer);
    };
  }, [dismiss, toast.id, toast.expiresAt, duration]);

  return (
    <motion.div
      data-toast
      layout={reduced ? false : 'position'}
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduced ? {} : { opacity: 0, y: 10 }}
      transition={{ type: 'tween', duration: reduced ? 0 : 0.18, ease: 'easeOut' }}
      aria-hidden={!present || undefined}
      ref={ref}
      className="pointer-events-auto flex w-full max-w-sm flex-wrap items-center gap-1 rounded-xl border border-line bg-surface py-2 pr-2 pl-4 text-sm shadow-soft"
    >
      <p className="min-w-0 flex-1 basis-28 py-1.5 wrap-break-word">{toast.message}</p>
      {[toast.action, toast.secondaryAction].map(
        (action, index) =>
          action && (
            <button
              key={index}
              type="button"
              onClick={() => {
                if (index === 0) dismiss(toast.id);
                else
                  useToastStore
                    .getState()
                    .updateToast(toast.id, toast.message, { secondaryAction: undefined });
                action.run();
              }}
              className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-accent-ink hover:bg-accent-soft"
            >
              {action.label}
            </button>
          ),
      )}
      <IconButton
        label={TOAST_TEXTS.close}
        onClick={() => {
          dismiss(toast.id);
        }}
      >
        <CloseIcon className="size-4" />
      </IconButton>
    </motion.div>
  );
}
