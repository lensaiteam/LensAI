import type { DB } from "../capture/db/client";
import { createDerivedDal, type RegimeRow } from "./derivedDal";

/**
 * Regime tags v1 (Phase 2 amendment #6): a SMALL, hand-written, documented rule
 * set — curation, not discovery, same discipline as the mechanism graph. Each
 * rule classifies a factor's own-history percentile (from factor_percentiles)
 * into a labeled band. Bands are intentionally crude in v1; the point is a
 * documented, reproducible starting set. rule_version + params are stamped on
 * every derived regime row.
 *
 * v1 rules (all off the 365d window):
 *   funding_regime[asset]  funding_rate pct -> elevated / neutral / suppressed
 *   oi_regime[asset]       open_interest pct -> elevated / neutral / suppressed
 *   dollar_regime (market) macro_dxy    pct -> strong  / neutral / weak
 * A stream with insufficient_history (or absent) yields "unknown" — never a guess.
 */

export const REGIME_RULE_VERSION = "regime-v1";
const HI = 0.8;
const LO = 0.2;

interface RegimeRule {
  key: string;
  stream: string;
  /** Canonical source for this regime (one factor stream can have many sources). */
  source: string;
  window: string;
  scope: "per_asset" | "market";
  /** For market-scope rules, the asset to read (stored under asset=''). */
  marketAsset?: string;
  /** [high-band, mid-band, low-band] labels. */
  labels: [string, string, string];
}

const RULES: RegimeRule[] = [
  { key: "funding_regime", stream: "funding_rate", source: "binance", window: "365d", scope: "per_asset", labels: ["elevated", "neutral", "suppressed"] },
  { key: "oi_regime", stream: "open_interest", source: "binance", window: "365d", scope: "per_asset", labels: ["elevated", "neutral", "suppressed"] },
  { key: "dollar_regime", stream: "macro_dxy", source: "fred", window: "365d", scope: "market", marketAsset: "DXY", labels: ["strong", "neutral", "weak"] },
];

function band(percentile: number, labels: [string, string, string]): string {
  return percentile >= HI ? labels[0] : percentile <= LO ? labels[2] : labels[1];
}

/** Keep one percentile row per asset — prefer status ok, then more observations. */
function dedupeByAsset<T extends { asset: string; status: string; n_obs: number }>(rows: T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    const cur = best.get(r.asset);
    if (!cur) { best.set(r.asset, r); continue; }
    const rBetter = (r.status === "ok" ? 1 : 0) - (cur.status === "ok" ? 1 : 0) || r.n_obs - cur.n_obs;
    if (rBetter > 0) best.set(r.asset, r);
  }
  return [...best.values()];
}

export interface ComputeRegimeOptions {
  asOf: number;
  slot: number;
  computedAt?: number;
}

/**
 * Classify regimes from the percentiles already written for (asOf, slot) — run
 * normalizeAll first. Idempotent (derived DAL upserts). Returns the rows written.
 */
export function computeRegimes(db: DB, opts: ComputeRegimeOptions): RegimeRow[] {
  const derived = createDerivedDal(db);
  const computedAt = opts.computedAt ?? Date.now();
  const out: RegimeRow[] = [];

  for (const rule of RULES) {
    const rows = derived
      .getPercentiles({ stream: rule.stream, window_id: rule.window, as_of: opts.asOf, slot: opts.slot })
      .filter((r) => r.source === rule.source); // canonical source per regime
    const scoped = rule.scope === "market" ? rows.filter((r) => r.asset === rule.marketAsset) : rows;
    // One regime per asset: if a source has several instruments for an asset,
    // prefer an "ok" row with the most observations.
    const relevant = dedupeByAsset(scoped);

    for (const p of relevant) {
      const value = p.status === "ok" && p.percentile != null ? band(p.percentile, rule.labels) : "unknown";
      const row: RegimeRow = {
        regime_key: rule.key,
        asset: rule.scope === "market" ? "" : p.asset,
        slot: opts.slot,
        regime_value: value,
        as_of: opts.asOf,
        rule_version: REGIME_RULE_VERSION,
        params: { stream: rule.stream, window: rule.window, hi: HI, lo: LO, inputPercentile: p.percentile, inputStatus: p.status },
        computed_at: computedAt,
      };
      derived.upsertRegime(row);
      out.push(row);
    }
  }
  return out;
}
