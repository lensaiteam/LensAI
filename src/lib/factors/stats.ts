/**
 * Percentile math for the factor state store — the point where the two clocks and
 * vintage honesty are enforced (Phase 2 sharpenings #1-#3).
 *
 * Inputs are corpus rows already ACCESS-gated by the as_of DAL (captured_at <=
 * run anchor). Here we work on the OTHER clock: a statistic for slot T uses
 * observations with observed_at <= T. Revisions collapse to the latest captured
 * value; vintage records whether the result would have been knowable live at T.
 */

export interface RawPoint {
  observed_at: number;
  value: number | null;
  captured_at: number;
}

export interface ResolvedPoint {
  observedAt: number;
  value: number;
  capturedAt: number;
}

export type Vintage = "true_pit" | "current_vintage";
export type StatStatus = "ok" | "insufficient_history";

export interface WindowStat {
  status: StatStatus;
  /** Current state value at slot T (best available, latest revision). */
  value: number | null;
  /** 0..1, count(v <= state)/n. null when insufficient_history. */
  percentile: number | null;
  nObs: number;
  vintage: Vintage;
  /** T - the state observation's observed_at (how stale the reading is at T). */
  stalenessMs: number | null;
  stateObservedAt: number | null;
}

/**
 * Collapse raw rows to one value per observed_at: the latest revision knowable at
 * `asOf` (max captured_at <= asOf). Drops null values. Sorted ascending by
 * observed_at. This is the "value at anchor = latest captured_at <= run-as_of with
 * observed_at <= T" rule, applied across the whole series.
 */
export function resolveSeries(rows: RawPoint[], asOf: number): ResolvedPoint[] {
  const byObserved = new Map<number, ResolvedPoint>();
  for (const r of rows) {
    if (r.value == null) continue;
    if (r.captured_at > asOf) continue; // defensive; the DAL already gates on this
    const cur = byObserved.get(r.observed_at);
    if (!cur || r.captured_at > cur.capturedAt) {
      byObserved.set(r.observed_at, { observedAt: r.observed_at, value: r.value, capturedAt: r.captured_at });
    }
  }
  return [...byObserved.values()].sort((a, b) => a.observedAt - b.observedAt);
}

/** Fraction of values <= x. 0..1. */
export function percentileRankLE(values: number[], x: number): number {
  if (values.length === 0) return 0;
  let c = 0;
  for (const v of values) if (v <= x) c++;
  return c / values.length;
}

/**
 * Compute the windowed percentile of the current state value at slot T.
 * - window = resolved points with observed_at in (T - lookback, T]  (full = all <= T)
 * - state  = the most recent point in the window (max observed_at)
 * - vintage = true_pit iff every window point was captured at/<=T; if any input
 *   (a backfilled row or a revision captured after T) has captured_at > T, the
 *   statistic used hindsight -> current_vintage.
 * - below minObs -> insufficient_history (value kept, percentile null).
 */
export function computeWindowStat(resolved: ResolvedPoint[], T: number, lookbackMs: number | null, minObs: number): WindowStat {
  const window = resolved.filter((e) => e.observedAt <= T && (lookbackMs == null || e.observedAt > T - lookbackMs));
  if (window.length === 0) {
    return { status: "insufficient_history", value: null, percentile: null, nObs: 0, vintage: "true_pit", stalenessMs: null, stateObservedAt: null };
  }
  const state = window[window.length - 1]; // sorted ascending -> last is max observed_at
  const vintage: Vintage = window.every((e) => e.capturedAt <= T) ? "true_pit" : "current_vintage";
  const stalenessMs = T - state.observedAt;

  if (window.length < minObs) {
    return { status: "insufficient_history", value: state.value, percentile: null, nObs: window.length, vintage, stalenessMs, stateObservedAt: state.observedAt };
  }
  return {
    status: "ok",
    value: state.value,
    percentile: percentileRankLE(window.map((e) => e.value), state.value),
    nObs: window.length,
    vintage,
    stalenessMs,
    stateObservedAt: state.observedAt,
  };
}
