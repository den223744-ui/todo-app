import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

import { LIST_ACTION_TEXTS } from '../../constants/texts';

interface DeleteListDialogProps {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function DeleteListDialog({ name, onCancel, onConfirm }: DeleteListDialogProps) {
  const controls = useAnimationControls();
  const reduced = useReducedMotion();
  const closing = useRef(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    dialogRef.current?.showModal();
    cancelRef.current?.focus();
    void controls.start({
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0 : 0.18, ease: 'easeOut' },
    });
  }, [controls, reduced]);
  const close = (callback: () => void) => {
    if (closing.current) return;
    closing.current = true;
    const finish = () => {
      dialogRef.current?.close();
      callback();
    };
    if (reduced) finish();
    else
      void controls
        .start({ opacity: 0, y: 6, transition: { duration: 0.18, ease: 'easeOut' } })
        .then(finish);
  };
  const cancel = () => {
    close(onCancel);
  };
  const confirm = () => {
    close(onConfirm);
  };
  return createPortal(
    <motion.dialog
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={controls}
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-surface p-5 text-ink shadow-soft backdrop:bg-ink/30"
    >
      <h2 id={`${id}-title`} className="text-lg font-semibold wrap-anywhere">
        {LIST_ACTION_TEXTS.confirm(name)}
      </h2>
      <p id={`${id}-description`} className="mt-2 text-sm text-ink-muted">
        {LIST_ACTION_TEXTS.consequence}
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <button
          ref={cancelRef}
          type="button"
          onClick={cancel}
          className="min-h-11 rounded-lg border border-line px-4 text-sm"
        >
          {LIST_ACTION_TEXTS.cancel}
        </button>
        <button
          type="button"
          onClick={confirm}
          className="min-h-11 rounded-lg border border-danger px-4 text-sm text-danger"
        >
          {LIST_ACTION_TEXTS.delete}
        </button>
      </div>
    </motion.dialog>,
    document.body,
  );
}
