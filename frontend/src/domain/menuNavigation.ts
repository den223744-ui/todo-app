/**
 * Arrow-key movement in a menu (WAI-ARIA menu pattern): arrows step and wrap
 * around, Home and End jump to the ends. Returns null for any other key.
 */
export function nextMenuIndex(key: string, current: number, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    case 'ArrowDown':
    case 'ArrowRight':
      return (current + 1 + count) % count;
    case 'ArrowUp':
    case 'ArrowLeft':
      // From "nothing focused" (-1) the first step up lands on the last item.
      return (Math.max(current, 0) - 1 + count) % count;
    default:
      return null;
  }
}
