import { useEffect } from 'react';

import { useToastStore } from '../../store/toastStore';

/**
 * Text fields with text in them keep their own Ctrl/Cmd+Z (undo typing). An
 * empty field has nothing to undo: after a delete focus often lands in the
 * empty quick add field, and Ctrl+Z there should still bring the task back.
 */
function isEditing(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return target.value !== '';
  }
  return target instanceof HTMLElement && (target.isContentEditable || target.tagName === 'SELECT');
}

/** Ctrl/Cmd+Z outside text fields undoes the newest delete or completion. */
export function UndoShortcut() {
  const undoLatest = useToastStore((state) => state.undoLatest);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isUndo =
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === 'z';
      if (!isUndo || isEditing(event.target)) return;
      if (undoLatest()) event.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [undoLatest]);

  return null;
}
