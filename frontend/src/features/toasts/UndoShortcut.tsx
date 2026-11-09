import { useEffect } from 'react';

import { useToastStore } from '../../store/toastStore';
import { useUiStore } from '../../store/uiStore';

/**
 * Text fields with text in them keep their own Ctrl/Cmd+Z (undo typing). An
 * empty field has nothing to undo: after a delete focus often lands in the
 * empty quick add field, and Ctrl+Z there should still bring the task back.
 */
const TEXT_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number']);

function isEditing(target: EventTarget | null): boolean {
  // A checkbox or a button keeps focus after a click; Ctrl+Z there is ours.
  if (target instanceof HTMLInputElement) {
    return TEXT_INPUTS.has(target.type) && target.value !== '';
  }
  if (target instanceof HTMLTextAreaElement) return target.value !== '';
  return target instanceof HTMLElement && (target.isContentEditable || target.tagName === 'SELECT');
}

/** Ctrl/Cmd+Z outside text fields undoes the newest delete or completion. */
export function UndoShortcut() {
  const undoLatest = useToastStore((state) => state.undoLatest);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const state = useUiStore.getState();
      if (
        event.defaultPrevented ||
        event.isComposing ||
        state.dragging ||
        state.paletteOpen ||
        state.helpOpen ||
        state.drawerOpen ||
        document.querySelector('[aria-modal="true"], dialog[open]')
      )
        return;
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
