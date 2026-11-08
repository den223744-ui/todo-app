import { useEffect } from 'react';

import { IconButton } from '../../components/IconButton';
import { CloseIcon } from '../../components/icons/CloseIcon';
import { TOAST_TEXTS } from '../../constants/texts';
import { useToastStore, type Toast } from '../../store/toastStore';

/** How long a toast stays; it can always be closed earlier. */
export const TOAST_DURATION_MS = 6_000;

export function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => {
      dismiss(toast.id);
    }, TOAST_DURATION_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [dismiss, toast.id]);

  return (
    <div className="pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl border border-line bg-surface py-2 pr-2 pl-4 text-sm shadow-soft">
      <p className="flex-1 py-1.5">{toast.message}</p>
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
