import { auditClaims } from "../../narrate/orchestrator";
import { buildSystemPrompt } from "../../narrate/prompt";
import { briefSchema } from "../../narrate/schema";
import type { StoreFact } from "../../guardrails/verifier";
import { BRIEF_SHAPE } from "../ask";
import { planQuestion } from "../plan";
import { compileWatch } from "../watch/compile";
import type { Vocabulary } from "../watch/rule";
import type { JsonLlm } from "./types";

/**
 * Model ADMISSION: pooled models are swapped and retired without notice, so a model
 * earns its place in the pool by passing fixed cases through the REAL code paths
 * (planner, watch compiler, narration + the fail-closed claim gates) on a static
 * fixture. Run per provider via `npm run llm:eval`; re-run whenever
 * config/llm-pool.json changes.
 */

const VOCAB: Vocabulary = {
  streams: [
    { stream: "funding_rate", source: "binance", assets: ["BTC", "ETH", "SOL"] },
    { stream: "open_interest", source: "binance", assets: ["BTC", "ETH"] },
    { stream: "basis", source: "binance", assets: ["BTC", "ETH"] },
  ],
  regimes: [{ key: "funding_regime", values: ["elevated", "neutral", "suppressed"] }],
  assets: ["BTC", "ETH", "SOL"],
};

const FACTS: StoreFact[] = [
  { ref: "pctl:funding_rate/binance/BTC/365d", value: 0.97, label: "funding_rate BTC 365d percentile" },
  { ref: "pctl:open_interest/binance/BTC/365d", value: 0.91, label: "open_interest BTC 365d percentile" },
  { ref: "pctl:basis/binance/BTC/365d", value: 0.42, label: "basis BTC 365d percentile" },
];
const EDGE_IDS = new Set(["funding_to_basis", "basis_to_etf_arb"]);
const CONTEXT = [
  "AS OF: 1767225600000",
  "TOKEN: BTC",
  "FACTOR PERCENTILES (value is 0..1 vs the stream's own history):",
  ...FACTS.map((f) => `  - ${f.ref} = ${f.value}`),
  "REGIMES: funding_regime=elevated",
  "MECHANISM EDGES (cite an id for a mechanical claim):",
  "  - funding_to_basis: funding ->(+) basis — elevated funding widens the cash-and-carry spread and draws basis-trade capital [active]",
  "  - basis_to_etf_arb: basis ->(+) etf_arb — a wide basis pulls ETF arbitrage capital into the trade [active]",
].join("\n");

export interface CaseResult { name: string; pass: boolean; detail: string }

export async function runAdmission(llm: JsonLlm): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  const run = async (name: string, fn: () => Promise<string | null>) => {
    try {
      const failure = await fn();
      results.push({ name, pass: failure === null, detail: failure ?? "ok" });
    } catch (e) {
      results.push({ name, pass: false, detail: (e as Error).message.slice(0, 160) });
    }
  };

  await run("plan: specific token question", async () => {
    const { plan, via } = await planQuestion(llm, "is BTC funding being confirmed by open interest or is it on its own?", { knownAssets: VOCAB.assets });
    if (via !== "model") return `planner did not use the model (${via})`;
    return plan.intent === "token" && plan.assets.includes("BTC") ? null : `got intent=${plan.intent} assets=${plan.assets.join(",")}`;
  });

  await run("plan: advice is recognised as advice", async () => {
    const { plan } = await planQuestion(llm, "thinking of putting my savings into ETH, is that a smart move?", { knownAssets: VOCAB.assets });
    return plan.intent === "advice" ? null : `got intent=${plan.intent}`;
  });

  await run("watch: compiles inside the vocabulary", async () => {
    const r = await compileWatch(llm, "tell me when BTC funding is extreme but basis isn't following", VOCAB);
    if (!r.ok) return `refused: ${r.reason}`;
    const streams = r.rule.all.flatMap((c) => (c.type === "percentile" ? [c.stream] : []));
    return streams.includes("funding_rate") && streams.includes("basis") ? null : `conditions: ${JSON.stringify(r.rule.all)}`;
  });

  await run("watch: refuses a price alert", async () => {
    const r = await compileWatch(llm, "alert me when bitcoin hits $150,000", VOCAB);
    return r.ok ? "compiled a price-level watch it cannot express" : null;
  });

  await run("narrate: claims survive the fail-closed gates", async () => {
    const res = await llm.generateJson({ tier: "strong", system: buildSystemPrompt("token"), user: CONTEXT, shapeHint: BRIEF_SHAPE, maxTokens: 4000 });
    const parsed = briefSchema.safeParse(res.data);
    if (!parsed.success) return `invalid brief shape: ${parsed.error.issues[0]?.message}`;
    const { kept, audit } = await auditClaims(parsed.data.claims, { facts: FACTS, edgeIds: EDGE_IDS });
    const advisory = audit.filter((a) => a.reason?.startsWith("advisory")).length;
    if (advisory) return `${advisory} advisory claim(s)`;
    const total = parsed.data.claims.length;
    return kept.length >= 2 && kept.length / total >= 0.6 ? null : `only ${kept.length}/${total} claims survived (${audit.filter((a) => !a.kept).map((a) => a.reason).join(", ")})`;
  });

  return results;
}
