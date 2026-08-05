import type { DB } from "../capture/db/client";
import { getMarketState, getTokenFactorState, getDivergences, getMechanism } from "../tools/handlers";
import type { StoreFact } from "../guardrails/verifier";

/**
 * Assemble the grounded context for narration from the point-in-time tool layer.
 * The model only ever sees measured facts + graph + fired flags — never raw feeds.
 * We also extract the numeric StoreFacts the ClaimVerifier resolves against, and
 * the set of valid mechanism edge ids a "mechanical" claim may cite.
 */
export interface GatheredContext {
  asOf: number;
  surface: "market" | "token";
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
