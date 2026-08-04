import type { DivergenceFlag } from "./types";
import { worstVintage } from "./types";
import type { ResolvedPoint, Vintage } from "../factors/stats";

/**
 * Broken-relationship flags — graph-driven. For a mechanism-graph edge whose BOTH
 * endpoints are measured factors, fire when the two factors' recent co-movement
 * CONTRADICTS the edge's documented polarity (positive = same direction, negative
 * = opposite). Pairs come only from the graph; the engine never invents them.
 */

export type Direction = "up" | "down" | "flat" | "unknown";

export interface FactorDirection {
  dir: Direction;
  from: number | null;
  to: number | null;
  vintage: Vintage;
}

function latestAtOrBefore(series: ResolvedPoint[], t: number): ResolvedPoint | null {
  let hit: ResolvedPoint | null = null;
  for (const p of series) {
    if (p.observedAt <= t) hit = p; // series is sorted ascending
    else break;
  }
  return hit;
}

/** Recent direction of a resolved series at slot T over `lookbackMs`. */
export function directionFromSeries(series: ResolvedPoint[], T: number, lookbackMs: number, flatEps = 0): FactorDirection {
  const now = latestAtOrBefore(series, T);
  const past = latestAtOrBefore(series, T - lookbackMs);
  if (!now || !past) return { dir: "unknown", from: past?.value ?? null, to: now?.value ?? null, vintage: "true_pit" };
  const delta = now.value - past.value;
  const dir: Direction = Math.abs(delta) <= flatEps ? "flat" : delta > 0 ? "up" : "down";
  const vintage: Vintage = now.capturedAt <= T && past.capturedAt <= T ? "true_pit" : "current_vintage";
  return { dir, from: past.value, to: now.value, vintage };
}

export interface EdgeInput {
  id: string;
  src: string;
  dst: string;
  polarity: string; // positive | negative | conditional
  channel: string | null;
}

/** Decide whether an edge's relationship has broken given both factors' directions. */
export function relationshipFlag(edge: EdgeInput, srcDir: FactorDirection, dstDir: FactorDirection): DivergenceFlag {
  const vintage = worstVintage(srcDir.vintage, dstDir.vintage);
  const base = { kind: "broken_relationship" as const, subject: edge.id, window_id: "", vintage };

  if (edge.polarity === "conditional") {
    return { ...base, fired: false, magnitude: null, status: "indeterminate", detail: { reason: "conditional polarity — not auto-checked", channel: edge.channel } };
  }
  if (srcDir.dir === "unknown" || dstDir.dir === "unknown" || srcDir.dir === "flat" || dstDir.dir === "flat") {
    return { ...base, fired: false, magnitude: null, status: "indeterminate", detail: { reason: "direction unclear", src: srcDir.dir, dst: dstDir.dir } };
  }

  const sameDirection = srcDir.dir === dstDir.dir;
  const expectSame = edge.polarity === "positive";
  const consistent = expectSame === sameDirection;

  return {
    ...base,
    fired: !consistent, // "broken" = the documented channel isn't transmitting
    magnitude: consistent ? 0 : 1,
    status: "ok",
    detail: {
      polarity: edge.polarity, channel: edge.channel,
      src: { node: edge.src, dir: srcDir.dir }, dst: { node: edge.dst, dir: dstDir.dir },
      consistent,
    },
  };
}
