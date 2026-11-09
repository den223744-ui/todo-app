import { TEXTS } from '../../constants/texts';

/** The bin on the open task's row. */
export function DeleteRowButton({ title, onDelete }: { title: string; onDelete: () => void }) {
  return (
    <button
      type="button"
      aria-label={TEXTS.deleteTaskNamed(title)}
      onClick={(event) => {
        // Never delete on the second click of a double click (rename).
        if (event.detail > 1) return;
        onDelete();
      }}
      className="mr-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-subtle hover:text-danger"
    >
      <svg
        className="size-[18px]"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 6h12M8.2 6V4.4h3.6V6M5.6 6l.8 10h7.2l.8-10M8.6 9v4.4M11.4 9v4.4" />
      </svg>
    </button>
  );
}
