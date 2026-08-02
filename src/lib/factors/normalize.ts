import type { DB } from "../capture/db/client";
import { createDal } from "../capture/db/dal";
import { createDerivedDal, type PercentileRow } from "./derivedDal";
import { resolveSeries, computeWindowStat } from "./stats";
import { DEFAULT_WINDOWS, MIN_OBS, NORMALIZER_CODE_VERSION, type WindowDef } from "./windows";
import { slotFloor } from "./clock";

/**
 * The normalizer (Phase 2 amendment #3): produces a factor's percentile state
 * over the named windows, anchored to an as_of, into the derived table.
 *
 * TWO CLOCKS: the corpus read is ACCESS-gated by the as_of DAL (captured_at <=
 * asOf, INV-2 untouched); the windows slice the resulting series on observed_at
 * (state at slot T). Re-runnable at any past instant by passing {asOf, slot} —
 * that is what makes the future calibration record possible.
 */

export interface NormalizeTarget {
  stream: string;
  source: string;
  asset: string;
  instrument?: string;
}

export interface NormalizeOptions {
  /** Run anchor / knowledge cutoff (captured_at gate). Default: now. */
  asOf?: number;
  /** State slot T on the observed_at clock. Default: slotFloor(asOf). */
  slot?: number;
  windows?: WindowDef[];
  minObs?: number;
  computedAt?: number;
}

/** Normalize one factor series into the named-window percentile rows. */
export function normalizeTarget(db: DB, t: NormalizeTarget, opts: NormalizeOptions = {}): PercentileRow[] {
  const dal = createDal(db);
  const derived = createDerivedDal(db);
  const asOf = opts.asOf ?? Date.now();
  const slot = opts.slot ?? slotFloor(asOf);
  const windows = opts.windows ?? DEFAULT_WINDOWS;
  const minObs = opts.minObs ?? MIN_OBS;
  const computedAt = opts.computedAt ?? Date.now();
  const instrument = t.instrument ?? "";

  const rows = dal.getObservations({ asOf, stream: t.stream, source: t.source, asset: t.asset, instrument });
  const resolved = resolveSeries(rows.map((r) => ({ observed_at: r.observed_at, value: r.value, captured_at: r.captured_at })), asOf);

  const out: PercentileRow[] = [];
  for (const w of windows) {
    const s = computeWindowStat(resolved, slot, w.lookbackMs, minObs);
    const row: PercentileRow = {
      stream: t.stream,
      source: t.source,
      asset: t.asset,
      instrument,
      slot,
      window_id: w.id,
      status: s.status,
      value: s.value,
      percentile: s.percentile,
      n_obs: s.nObs,
      vintage: s.vintage,
      staleness_ms: s.stalenessMs,
      as_of: asOf,
      code_version: NORMALIZER_CODE_VERSION,
      params: { window_id: w.id, lookbackMs: w.lookbackMs, minObs, method: "rank-le" },
      computed_at: computedAt,
    };
    derived.upsertPercentile(row);
    out.push(row);
  }
  return out;
}

/** Distinct factor series present in the corpus as of `asOf` (point-in-time). */
export function discoverTargets(db: DB, asOf: number): NormalizeTarget[] {
  return db
    .prepare(
      `SELECT DISTINCT stream, source, asset, instrument
       FROM factor_observations WHERE captured_at <= ?
       ORDER BY stream, source, asset, instrument`,
    )
    .all(asOf) as NormalizeTarget[];
}

/** Normalize every series present as of the anchor. */
export function normalizeAll(db: DB, opts: NormalizeOptions = {}): PercentileRow[] {
  const asOf = opts.asOf ?? Date.now();
  const targets = discoverTargets(db, asOf);
  return targets.flatMap((t) => normalizeTarget(db, t, { ...opts, asOf }));
}
