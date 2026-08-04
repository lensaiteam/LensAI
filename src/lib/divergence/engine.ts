import type { DB } from "../capture/db/client";
import { createDal } from "../capture/db/dal";
import { createDerivedDal, type PercentileRow, type RegimeRow } from "../factors/derivedDal";
import { createDivergenceDal, type DivergenceRow } from "./derivedDal";
import { getGraph } from "../mechanism/graph";
import { resolveSeries } from "../factors/stats";
import { slotFloor } from "../factors/clock";
import { extremeStateFlag } from "./extremeState";
import { directionFromSeries, relationshipFlag, type FactorDirection } from "./relationships";
import { computeSignatures, type SignatureContext, type PctileLookup } from "./signatures";
import type { DivergenceFlag } from "./types";
import {
  DIVERGENCE_CODE_VERSION, EXTREME_HIGH, EXTREME_LOW, EXTREME_WINDOW, COMOVE_LOOKBACK_MS,
  SIGNATURE_RULE_VERSION, OI_ELEVATED, OI_CALM, FUNDING_STRETCHED,
} from "./thresholds";

/**
 * Divergence engine — runs the three flag families at {asOf, slot} and writes the
 * derived table. Pure arithmetic; point-in-time (reads via the as_of DAL + the
 * point-in-time graph); re-runnable at any past anchor for calibration.
 */

const SIGNATURE_SOURCE = "binance"; // canonical source for structural-signature inputs

export interface DivergeOptions {
  asOf?: number;
  slot?: number;
  computedAt?: number;
}

/** Representative series for a factor stream: the (source,asset,instrument) with
 *  the most observations as of the anchor. (Dormant in graph-v1 — no factor↔factor
 *  edges — but correct once such edges are curated.) */
function directionFor(db: DB, stream: string, asOf: number, slot: number): FactorDirection {
  const top = db.prepare(
    `SELECT source, asset, instrument, count(*) c FROM factor_observations
     WHERE stream = ? AND captured_at <= ? GROUP BY source, asset, instrument ORDER BY c DESC LIMIT 1`,
  ).get(stream, asOf) as { source: string; asset: string; instrument: string } | undefined;
  if (!top) return { dir: "unknown", from: null, to: null, vintage: "true_pit" };
  const rows = createDal(db).getObservations({ asOf, stream, source: top.source, asset: top.asset, instrument: top.instrument });
  const resolved = resolveSeries(rows.map((r) => ({ observed_at: r.observed_at, value: r.value, captured_at: r.captured_at })), asOf);
  return directionFromSeries(resolved, slot, COMOVE_LOOKBACK_MS);
}

function buildSignatureContext(pctls: PercentileRow[], regimes: RegimeRow[]): SignatureContext {
  const pctlMap = new Map<string, PctileLookup>();
  const assets = new Set<string>();
  for (const p of pctls) {
    if (p.source !== SIGNATURE_SOURCE) continue;
    pctlMap.set(`${p.stream}|${p.asset}|${p.window_id}`, { percentile: p.percentile, status: p.status, vintage: p.vintage });
    if (p.stream === "funding_rate") assets.add(p.asset);
  }
  const regimeMap = new Map<string, string>();
  for (const r of regimes) regimeMap.set(`${r.regime_key}|${r.asset}`, r.regime_value);
  return {
    assets: [...assets],
    pctile: (stream, asset, window) => pctlMap.get(`${stream}|${asset}|${window}`) ?? null,
    regime: (key, asset) => regimeMap.get(`${key}|${asset}`) ?? null,
  };
}

export function runDivergence(db: DB, opts: DivergeOptions = {}): DivergenceRow[] {
  const asOf = opts.asOf ?? Date.now();
  const slot = opts.slot ?? slotFloor(asOf);
  const computedAt = opts.computedAt ?? Date.now();
  const derived = createDerivedDal(db);
  const divDal = createDivergenceDal(db);

  const flags: DivergenceFlag[] = [];

  // 1. extreme_state
  const pctls = derived.getPercentiles({ as_of: asOf, slot });
  for (const p of pctls) {
    const f = extremeStateFlag(p);
    if (f) flags.push(f);
  }

  // 2. broken_relationship — graph-driven, both-factor edges only
  const g = getGraph(db, { asOf });
  if (g) {
    const factorStream = new Map<string, string>();
    for (const n of g.nodes) if (n.kind === "factor" && n.factor_stream) factorStream.set(n.id, n.factor_stream);
    for (const e of g.edges) {
      const s = factorStream.get(e.src);
      const d = factorStream.get(e.dst);
      if (!s || !d) continue;
      const srcDir = directionFor(db, s, asOf, slot);
      const dstDir = directionFor(db, d, asOf, slot);
      flags.push(relationshipFlag({ id: e.id, src: e.src, dst: e.dst, polarity: e.polarity, channel: e.channel }, srcDir, dstDir));
    }
  }

  // 3. structural_signature
  const ctx = buildSignatureContext(pctls, derived.getRegimes({ as_of: asOf, slot }));
  flags.push(...computeSignatures(ctx));

  const params = {
    extremeHigh: EXTREME_HIGH, extremeLow: EXTREME_LOW, extremeWindow: EXTREME_WINDOW,
    comoveLookbackMs: COMOVE_LOOKBACK_MS, signatureRuleVersion: SIGNATURE_RULE_VERSION,
    oiElevated: OI_ELEVATED, oiCalm: OI_CALM, fundingStretched: FUNDING_STRETCHED,
  };
  const rows: DivergenceRow[] = flags.map((f) => ({ ...f, slot, as_of: asOf, code_version: DIVERGENCE_CODE_VERSION, params, computed_at: computedAt }));
  for (const r of rows) divDal.upsert(r);
  return rows;
}
