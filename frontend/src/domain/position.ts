/**
 * Fractional ordering for drag & drop: a moved task gets a position between
 * its new neighbours, so only that one task is written to the server.
 *
 * Halving a gap works ~50 times before floats run out of precision. When the
 * neighbours get that close, the whole list is renumbered (1, 2, 3, ...).
 */

const POSITION_STEP = 1;

/** Position between two neighbours; null means "no neighbour on that side". */
export function positionBetween(prev: number | null, next: number | null): number {
  if (prev === null && next === null) return POSITION_STEP;
  if (prev === null) return (next as number) - POSITION_STEP;
  if (next === null) return prev + POSITION_STEP;
  return prev + (next - prev) / 2;
}

/**
 * True when the new position would not land strictly between the neighbours:
 * the gap is used up, or at an end of the list the number is so large that
 * +1 / -1 no longer changes it (2 ** 53 + 1 === 2 ** 53).
 */
export function needsRebalance(prev: number | null, next: number | null): boolean {
  const candidate = positionBetween(prev, next);
  const afterPrev = prev === null || candidate > prev;
  const beforeNext = next === null || candidate < next;
  return !(afterPrev && beforeNext);
}

export interface Positioned {
  id: string;
  position: number;
}

export type MoveResult =
  { kind: 'single'; id: string; position: number } | { kind: 'rebalance'; positions: Positioned[] };

/**
 * Move `id` within `siblings` (already in display order) to `toIndex` — the
 * index it should have after the move. Returns the one new position, or new
 * positions for every sibling when the gap is exhausted.
 */
export function moveTo(siblings: readonly Positioned[], id: string, toIndex: number): MoveResult {
  const others = siblings.filter((item) => item.id !== id);
  const index = Math.max(0, Math.min(toIndex, others.length));
  const prev = others[index - 1]?.position ?? null;
  const next = others[index]?.position ?? null;

  if (!needsRebalance(prev, next)) {
    return { kind: 'single', id, position: positionBetween(prev, next) };
  }
  const ordered = [...others.slice(0, index), { id, position: 0 }, ...others.slice(index)];
  return {
    kind: 'rebalance',
    positions: ordered.map((item, i) => ({ id: item.id, position: (i + 1) * POSITION_STEP })),
  };
}
