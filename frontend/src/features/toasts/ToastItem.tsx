import { useEffect } from 'react';

import { IconButton } from '../../components/IconButton';
import { CloseIcon } from '../../components/icons/CloseIcon';
import { TOAST_TEXTS } from '../../constants/texts';
import { useToastStore, type Toast } from '../../store/toastStore';

/** How long a toast stays; it can always be closed earlier. */
export const TOAST_DURATION_MS = 6_000;

export function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismissToast);
  const duration = toast.duration ?? TOAST_DURATION_MS;

  useEffect(() => {
    const timer = setTimeout(() => {
      dismiss(toast.id);
    }, duration);
    return () => {
      clearTimeout(timer);
    };
  }, [dismiss, toast.id, duration]);

  return (
    <div className="pointer-events-auto flex w-full max-w-sm items-center gap-2 rounded-xl border border-line bg-surface py-2 pr-2 pl-4 text-sm shadow-soft">
      <p className="flex-1 py-1.5">{toast.message}</p>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            dismiss(toast.id);
            toast.action?.run();
          }}
          className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-accent-ink hover:bg-accent-soft"
        >
          {toast.action.label}
        </button>
      )}
      <IconButton
        label={TOAST_TEXTS.close}
        onClick={() => {
          dismiss(toast.id);
        }}
      >
        <CloseIcon className="size-4" />
      </IconButton>
    </div>
  );
}
