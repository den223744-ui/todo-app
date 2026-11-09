import { TOAST_TEXTS } from '../../constants/texts';
import { useToastStore } from '../../store/toastStore';
import { ToastItem } from './ToastItem';

/**
 * Toasts at the bottom of the screen. The region is polite live: screen
 * readers announce a new toast without interrupting.
 */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  return (
    <section
      aria-label={TOAST_TEXTS.region}
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[var(--quick-add-height,84px)] z-50 flex flex-col items-center gap-2 p-4 md:bottom-0 md:items-end"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </section>
  );
}
