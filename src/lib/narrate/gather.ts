import type { DB } from "../capture/db/client";
import { getMarketState, getTokenFactorState, getDivergences, getMechanism, searchCorpus, getClaims } from "../tools/handlers";
import type { StoreFact } from "../guardrails/verifier";
import type { Surface } from "./schema";

const WEEK = 7 * 86_400_000;

/**
 * Assemble the grounded context for narration from the point-in-time tool layer.
 * The model only ever sees measured facts + graph + fired flags — never raw feeds.
 * We also extract the numeric StoreFacts the ClaimVerifier resolves against, and
 * the set of valid mechanism edge ids a "mechanical" claim may cite.
 */
export interface GatheredContext {
  asOf: number;
  surface: Surface;
  asset?: string;
  data: Record<string, unknown>;
  facts: StoreFact[];
  edgeIds: Set<string>;
  contextText: string;
}

interface Pctl { stream: string; source: string; window_id: string; percentile: number | null; status: string }

function factsFromPercentiles(asset: string, rows: Pctl[]): StoreFact[] {
  return rows
    .filter((p) => p.status === "ok" && p.percentile != null)
    .map((p) => ({ ref: `pctl:${p.stream}/${p.source}/${asset}/${p.window_id}`, value: p.percentile as number, label: `${p.stream} ${asset} ${p.window_id} percentile` }));
}

function mechanismFacts(db: DB, asOf: number): { edgeIds: Set<string>; edges: { id: string; src: string; dst: string; polarity: string; mechanism: string; lifecycle: string; strength: string | null }[] } {
  const g = getMechanism(db, { asOf }) as { edges?: { id: string; src: string; dst: string; polarity: string; mechanism: string; lifecycle: string; strength: string | null }[] };
  const edges = g.edges ?? [];
  return { edgeIds: new Set(edges.map((e) => e.id)), edges };
}

export function gatherToken(db: DB, asset: string, asOf: number): GatheredContext {
  const state = getTokenFactorState(db, { asset, asOf }) as { as_of: number | null; percentiles?: Pctl[]; regimes?: { regime_key: string; value: string }[] };
  const market = getMarketState(db, { asOf }) as Record<string, unknown>;
  const { edgeIds, edges } = mechanismFacts(db, asOf);
  const facts = factsFromPercentiles(asset, state.percentiles ?? []);

  const contextText = [
    `AS OF: ${state.as_of ?? asOf}`,
    `TOKEN: ${asset}`,
    `FACTOR PERCENTILES (value is 0..1 vs the stream's own history):`,
    ...facts.map((f) => `  - ${f.ref} = ${f.value}`),
    `REGIMES: ${(state.regimes ?? []).map((r) => `${r.regime_key}=${r.value}`).join(", ") || "(none)"}`,
    `MARKET CONTEXT: ${JSON.stringify(market)}`,
    `MECHANISM EDGES (cite an id for a mechanical claim):`,
    ...edges.map((e) => `  - ${e.id}: ${e.src} ->(${e.polarity}) ${e.dst} — ${e.mechanism} [${e.lifecycle}, strength=${e.strength ?? "n/a"} (curated prior)]`),
  ].join("\n");

  return { asOf, surface: "token", asset, data: { state, market, edges }, facts, edgeIds, contextText };
}

export function gatherMarket(db: DB, asOf: number): GatheredContext {
  const market = getMarketState(db, { asOf }) as { as_of: number | null; regimes?: { regime_key: string; asset: string; value: string }[]; structural_signatures?: { subject: string; magnitude: number | null }[]; divergences?: { kind: string; subject: string; magnitude: number | null; detail?: Record<string, unknown> }[] };
  const { edgeIds, edges } = mechanismFacts(db, asOf);

  // Facts: any numeric percentile surfaced in a divergence detail.
  const facts: StoreFact[] = [];
  for (const d of market.divergences ?? []) {
    const pct = (d.detail as { percentile?: number } | undefined)?.percentile;
    if (typeof pct === "number") facts.push({ ref: `div:${d.kind}/${d.subject}`, value: pct, label: `${d.subject} percentile` });
  }

  const contextText = [
    `AS OF: ${market.as_of ?? asOf}`,
    `REGIMES: ${(market.regimes ?? []).map((r) => `${r.regime_key}[${r.asset}]=${r.value}`).join(", ") || "(none)"}`,
    `STRUCTURAL SIGNATURES (fired): ${(market.structural_signatures ?? []).map((s) => s.subject).join(", ") || "(none)"}`,
    `DIVERGENCES (fired): ${(market.divergences ?? []).map((d) => `${d.subject}(${d.kind})`).join(", ") || "(none)"}`,
    `MEASURED VALUES:`,
    ...facts.map((f) => `  - ${f.ref} = ${f.value}`),
    `MECHANISM EDGES (cite an id for a mechanical claim):`,
    ...edges.map((e) => `  - ${e.id}: ${e.src} ->(${e.polarity}) ${e.dst} — ${e.mechanism} [${e.lifecycle}]`),
  ].join("\n");

  return { asOf, surface: "market", data: { market, edges }, facts, edgeIds, contextText };
}

/**
 * Incident mechanics: hold trigger / amplifier / mechanism separately. Grounds on
 * the fired divergences (what broke), the mechanism edges (candidate channels),
 * recent corpus articles (the event), and typed claims (claimant + incentive).
 */
export function gatherIncident(db: DB, asset: string | undefined, asOf: number): GatheredContext {
  const div = getDivergences(db, { asOf, asset }) as { as_of: number | null; flags?: { kind: string; subject: string; magnitude: number | null; detail?: Record<string, unknown> }[] };
  const { edgeIds, edges } = mechanismFacts(db, asOf);
  const corpus = searchCorpus(db, { asset, since: asOf - WEEK, asOf, limit: 8 }) as { articles?: { source: string; title: string | null; url: string; published_at: number | null; content_hash: string }[] };
  const claims = getClaims(db, { asOf, limit: 20 }) as { claims?: { claimant: string; claimant_incentive: string | null; claim_text: string }[] };

  const facts: StoreFact[] = [];
  for (const f of div.flags ?? []) {
    const pct = (f.detail as { percentile?: number } | undefined)?.percentile;
    if (typeof pct === "number") facts.push({ ref: `div:${f.kind}/${f.subject}`, value: pct, label: `${f.subject} percentile` });
  }

  const contextText = [
    `AS OF: ${div.as_of ?? asOf}`,
    asset ? `SUBJECT: ${asset}` : `SUBJECT: market-wide`,
    `THE BREAK (fired divergences — hold trigger/amplifier/mechanism separately):`,
    ...(div.flags ?? []).map((f) => `  - ${f.kind} ${f.subject} (mag ${f.magnitude ?? "n/a"})`),
    `CANDIDATE CHANNELS (mechanism edges — cite an id for a mechanical link):`,
    ...edges.map((e) => `  - ${e.id}: ${e.src} ->(${e.polarity}) ${e.dst} — ${e.mechanism}`),
    `RECENT NEWS (immutable corpus, point-in-time):`,
    ...(corpus.articles ?? []).map((a) => `  - [${a.source}] ${a.title ?? "(untitled)"} <${a.content_hash.slice(0, 10)}>`),
    `TYPED CLAIMS (attribute causal claims to claimant + incentive):`,
    ...(claims.claims ?? []).map((c) => `  - ${c.claimant} (${c.claimant_incentive ?? "incentive unknown"}): ${c.claim_text}`),
  ].join("\n");

  return { asOf, surface: "incident", asset, data: { div, edges, corpus, claims }, facts, edgeIds, contextText };
}
