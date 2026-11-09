import { useEffect, type RefObject } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const isBefore = (a: Node, b: Node): boolean =>
  (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

/**
 * Keeps Tab / Shift+Tab inside a modal container (WAI-ARIA dialog pattern):
 * from the last element focus wraps to the first and back, so it never
 * reaches the page hidden behind the modal.
 */
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean): void {
  useEffect(() => {
    const container = ref.current;
    if (!active || !container) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      const current = document.activeElement;
      if (!(current instanceof HTMLElement) || !container.contains(current)) {
        // Focus is outside (or on the page body): bring it in.
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      // Where would the browser go next? Focus may sit on something that is
      // not in the Tab order itself (the container, a heading with
      // tabIndex=-1), so look for the neighbour by document position.
      const next = event.shiftKey
        ? focusable.filter((element) => isBefore(element, current)).at(-1)
        : focusable.find((element) => isBefore(current, element));
      if (!next) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, active]);
}
