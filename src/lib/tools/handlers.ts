import type { DB } from "../capture/db/client";
import { createDal } from "../capture/db/dal";
import { createDerivedDal } from "../factors/derivedDal";
import { createDivergenceDal } from "../divergence/derivedDal";
import { getGraph } from "../mechanism/graph";
import { resolveSeries } from "../factors/stats";

/**
 * Read-only, point-in-time handlers over the engine's stores — the "hands" SERA's
 * router calls. Every handler takes an optional `asOf` and returns JSON that
 * states the anchor it resolved to and carries provenance (vintage/window/refs).
 * Never advice; never lookahead.
 *
 * Derived artifacts (percentiles/regimes/divergences) exist only at the anchors
 * `normalize`/`diverge` ran, so handlers resolve the LATEST computed anchor
 * <= the requested asOf (point-in-time over the derived tables).
 */

export interface Anchor { as_of: number; slot: number }

export function resolveComputedAnchor(db: DB, asOf?: number): Anchor | null {
  const row = (asOf === undefined
    ? db.prepare("SELECT as_of, slot FROM factor_percentiles ORDER BY as_of DESC LIMIT 1").get()
    : db.prepare("SELECT as_of, slot FROM factor_percentiles WHERE as_of <= ? ORDER BY as_of DESC LIMIT 1").get(asOf)) as Anchor | undefined;
  return row ?? null;
}

export function getMarketState(db: DB, input: { asOf?: number }): unknown {
  const anchor = resolveComputedAnchor(db, input.asOf);
  if (!anchor) return { as_of: null, note: "no factor state computed yet (run normalize)" };
  const derived = createDerivedDal(db);
  const div = createDivergenceDal(db);
  const regimes = derived.getRegimes({ as_of: anchor.as_of, slot: anchor.slot }).map((r) => ({ regime_key: r.regime_key, asset: r.asset, value: r.regime_value }));
  const fired = div.get({ as_of: anchor.as_of, fired: true });
  return {
    as_of: anchor.as_of,
    slot: anchor.slot,
    regimes,
    structural_signatures: fired.filter((f) => f.kind === "structural_signature").map((f) => ({ subject: f.subject, magnitude: f.magnitude, vintage: f.vintage, detail: f.detail })),
    divergences: fired.filter((f) => f.kind !== "structural_signature").map((f) => ({ kind: f.kind, subject: f.subject, window_id: f.window_id, magnitude: f.magnitude, vintage: f.vintage, detail: f.detail })),
    note: "Assessment of current structure; not advice.",
  };
}

export function getTokenFactorState(db: DB, input: { asset: string; asOf?: number }): unknown {
  const anchor = resolveComputedAnchor(db, input.asOf);
  if (!anchor) return { as_of: null, asset: input.asset, note: "no factor state computed yet" };
  const derived = createDerivedDal(db);
  const pctls = derived.getPercentiles({ asset: input.asset, as_of: anchor.as_of, slot: anchor.slot });
  const regimes = derived.getRegimes({ asset: input.asset, as_of: anchor.as_of, slot: anchor.slot });
  return {
    as_of: anchor.as_of,
    asset: input.asset,
    percentiles: pctls.map((p) => ({ stream: p.stream, source: p.source, window_id: p.window_id, percentile: p.percentile, value: p.value, n_obs: p.n_obs, vintage: p.vintage, status: p.status, staleness_ms: p.staleness_ms })),
    regimes: regimes.map((r) => ({ regime_key: r.regime_key, value: r.regime_value })),
  };
}

export function getDivergences(db: DB, input: { asOf?: number; kind?: string; asset?: string }): unknown {
  const anchor = resolveComputedAnchor(db, input.asOf);
  if (!anchor) return { as_of: null, flags: [] };
  const div = createDivergenceDal(db);
  let flags = div.get({ as_of: anchor.as_of, fired: true, kind: input.kind });
  if (input.asset) flags = flags.filter((f) => f.subject.includes(input.asset!));
  return {
    as_of: anchor.as_of,
    slot: anchor.slot,
    flags: flags.map((f) => ({ kind: f.kind, subject: f.subject, window_id: f.window_id, magnitude: f.magnitude, vintage: f.vintage, detail: f.detail })),
  };
}

export function getMechanism(db: DB, input: { node?: string; channel?: string; asOf?: number }): unknown {
  const g = getGraph(db, { asOf: input.asOf });
  if (!g) return { version: null, edges: [], note: "no mechanism graph loaded" };
  let edges = g.edges;
  if (input.node) edges = edges.filter((e) => e.src === input.node || e.dst === input.node);
  if (input.channel) edges = edges.filter((e) => e.channel === input.channel);
  return {
    version: g.version,
    edges: edges.map((e) => ({
      id: e.id, src: e.src, dst: e.dst, polarity: e.polarity, channel: e.channel,
      mechanism: e.mechanism, conditions: e.conditions, lifecycle: e.lifecycle,
      strength: e.strength, strength_note: "curated prior, not a measured value",
      regimes_applies: e.regimes_applies, regimes_breaks: e.regimes_breaks,
    })),
  };
}

export function getFactorSeries(db: DB, input: { stream: string; asset: string; source?: string; asOf?: number; limit?: number }): unknown {
  const asOf = input.asOf ?? Date.now();
  const dal = createDal(db);
  const rows = dal.getObservations({ asOf, stream: input.stream, asset: input.asset, source: input.source });
  const resolved = resolveSeries(rows.map((r) => ({ observed_at: r.observed_at, value: r.value, captured_at: r.captured_at })), asOf);
  const limit = input.limit ?? 200;
  const points = resolved.slice(-limit).map((p) => ({ observed_at: p.observedAt, value: p.value }));
  return { as_of: asOf, stream: input.stream, asset: input.asset, n: points.length, points };
}

export function searchCorpus(db: DB, input: { asset?: string; query?: string; since?: number; asOf?: number; limit?: number }): unknown {
  const asOf = input.asOf ?? Date.now();
  const dal = createDal(db);
  const needle = (input.asset ?? input.query ?? "").toLowerCase();
  const limit = input.limit ?? 20;
  const rows = dal.getArticles({ asOf, since: input.since, limit: 500 });
  const matched = (needle
    ? rows.filter((r) => (r.title ?? "").toLowerCase().includes(needle) || r.extracted_text.toLowerCase().includes(needle))
    : rows
  ).slice(0, limit);
  return {
    as_of: asOf,
    count: matched.length,
    articles: matched.map((a) => ({ source: a.source, title: a.title, url: a.url, published_at: a.published_at, captured_at: a.captured_at, content_hash: a.content_hash })),
  };
}

export function getClaims(db: DB, input: { asOf?: number; claimant?: string; limit?: number }): unknown {
  const asOf = input.asOf ?? Date.now();
  const dal = createDal(db);
  const claims = dal.getClaims({ asOf, claimant: input.claimant, limit: input.limit ?? 50 });
  return {
    as_of: asOf,
    count: claims.length,
    claims: claims.map((c) => ({ claimant: c.claimant, claimant_incentive: c.claimant_incentive, claimed_at: c.claimed_at, claim_text: c.claim_text, mechanism_refs: c.mechanism_refs })),
  };
}
