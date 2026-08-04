import type { DivergenceFlag } from "./types";
import type { Vintage } from "../factors/stats";
import { EXTREME_HIGH, EXTREME_LOW, EXTREME_WINDOW } from "./thresholds";

/** Minimal shape of a factor_percentiles row this rule needs. */
export interface PercentileInput {
  stream: string;
  source: string;
  asset: string;
  window_id: string;
  status: "ok" | "insufficient_history";
  percentile: number | null;
  value: number | null;
  n_obs: number;
  vintage: Vintage;
}

/**
 * Extreme-state flag: fire when a factor's own-history percentile is at/above
 * HIGH or at/below LOW, over the configured window. insufficient_history -> an
 * `indeterminate` flag (thin data is a flagged risk, never a fabricated signal).
 * Returns null for percentile rows on other windows.
 */
export function extremeStateFlag(p: PercentileInput): DivergenceFlag | null {
  if (p.window_id !== EXTREME_WINDOW) return null;
  const subject = `${p.stream}/${p.source}/${p.asset}`;

  if (p.status !== "ok" || p.percentile == null) {
    return {
      kind: "extreme_state", subject, window_id: p.window_id, fired: false, magnitude: null,
      status: "indeterminate", vintage: p.vintage, detail: { reason: "insufficient_history", n_obs: p.n_obs },
    };
  }

  const high = p.percentile >= EXTREME_HIGH;
  const low = p.percentile <= EXTREME_LOW;
  const fired = high || low;
  const magnitude = high ? p.percentile - EXTREME_HIGH : low ? EXTREME_LOW - p.percentile : 0;

  return {
    kind: "extreme_state", subject, window_id: p.window_id, fired, magnitude, status: "ok", vintage: p.vintage,
    detail: {
      direction: high ? "high" : low ? "low" : "none",
      percentile: p.percentile, value: p.value, n_obs: p.n_obs,
      thresholds: { high: EXTREME_HIGH, low: EXTREME_LOW },
    },
  };
}
