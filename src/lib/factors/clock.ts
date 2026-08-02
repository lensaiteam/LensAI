/**
 * One clock (Phase 2 amendment #5): a canonical UTC slot grid that every stream
 * maps onto. State at slot T is evaluated as of observed_at <= T (see stats.ts);
 * each derived row also carries staleness (T - the state observation's
 * observed_at), so a lagging stream (FRED prints days late) is visible, never
 * smoothed over.
 *
 * TWO CLOCKS (sharpening #1): the grid/window live on `observed_at` (market
 * time); data ACCESS is gated separately by the as_of DAL on `captured_at`
 * (knowledge time). Never conflate them.
 */
export const HOUR = 3_600_000;
export const DAY = 86_400_000;

/** Canonical grid step. Factors are joined on this UTC grid. */
export const CANONICAL_STEP_MS = HOUR;

/** Floor a timestamp to the grid. */
export function slotFloor(t: number, stepMs: number = CANONICAL_STEP_MS): number {
  return Math.floor(t / stepMs) * stepMs;
}

/** Inclusive grid of slot boundaries in [fromT, toT]. */
export function slotGrid(fromT: number, toT: number, stepMs: number = CANONICAL_STEP_MS): number[] {
  const out: number[] = [];
  for (let s = slotFloor(fromT, stepMs); s <= toT; s += stepMs) out.push(s);
  return out;
}
