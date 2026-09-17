import { z } from "zod";
import type { DB } from "../capture/db/client";
import { assertNonAdvisory, checkNonAdvisory } from "../guardrails/outputFilter";
import type { StoreFact } from "../guardrails/verifier";
import { getMechanism, getTokenFactorState, resolveComputedAnchor } from "../tools/handlers";
import type { JsonLlm } from "./llm/types";
import { findAssets } from "./plan";
import { scrubIdentifiers } from "./privacy";
import { loadVocabulary } from "./watch/rule";

/**
 * Claim-checker: paste a post/thread/article → the claims it makes, each checked
 * against the desk's own store. The model ONLY extracts and maps (claim → store
 * ref / mechanism edge); the verdict is arithmetic:
 *   supported      every mapped number matches the store (±1%)
 *   contradicted   a mapped number disagrees — the store value is shown
 *   unverifiable   the desk does not measure what the claim asserts
 * A causal claim is "documented" only if it maps to a real mechanism-graph edge.
 */

const extractedSchema = z.object({
  claims: z
    .array(
      z.object({
        text: z.string().min(1).max(400),
        claimant: z.string().max(80).nullable().default(null),
        numbers: z.array(z.object({ value: z.number(), unit: z.string().nullable().default(null), ref: z.string().nullable().default(null) })).default([]),
        causal: z.boolean().default(false),
        edge_id: z.string().nullable().default(null),
      }),
    )
    .max(12)
    .default([]),
});

export type Verdict = "supported" | "contradicted" | "unverifiable";

export interface CheckedClaim {
  text: string;
  claimant: string | null;
  verdict: Verdict;
  evidence: string[];
  mechanism: "documented" | "undocumented" | "n/a";
  edgeId: string | null;
  /** The claim itself reads as a trade instruction; it is reported, not echoed. */
  advisory: boolean;
}

export interface ClaimCheckResult {
  asOf: number | null;
  claims: CheckedClaim[];
  text: string;
  provider: string | null;
}

const SHAPE = `{"claims": [{"text": "<the claim, quoted or tightly paraphrased>", "claimant": "<who asserts it, or null>", "numbers": [{"value": <number>, "unit": "<percentile|percent|usd|...|null>", "ref": "<the FACTS ref this number should equal, or null if none applies>"}], "causal": <true if it asserts X causes/drives Y>, "edge_id": "<the MECHANISM EDGE id it corresponds to, or null>"}]}`;

const SYSTEM = [
  "You extract checkable claims from a pasted crypto post for LensAI, a non-advisory research desk. You do NOT judge them.",
  "For each factual or causal claim (max 12; skip pure opinion, hype and greetings):",
  "  - copy it tightly; note the claimant if the text names one;",
  "  - list every number it states and map each to the ONE ref in FACTS that measures the same thing, else null.",
  "    `pctl:` refs are 0..1 percentiles vs the stream's own history; `val:` refs are the latest raw reading;",
  "  - if it asserts a causal link, map it to the matching MECHANISM EDGE id, else null.",
  "Never invent a ref or an edge id — use only those listed.",
].join("\n");

const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-9, 0.01 * Math.abs(b));

export async function checkClaims(deps: { db: DB; llm: JsonLlm }, rawText: string, opts: { forbid?: string[]; now?: number } = {}): Promise<ClaimCheckResult> {
  const { db, llm } = deps;
  const now = opts.now ?? Date.now();
  const anchor = resolveComputedAnchor(db, now);
  if (!anchor) return { asOf: null, claims: [], provider: null, text: "The desk has not computed any factor state yet, so there is nothing to check against." };

  const text = scrubIdentifiers(rawText).slice(0, 6000);
  const vocab = loadVocabulary(db, now);
  const assets = findAssets(text, vocab.assets);
  const subjects = assets.length ? assets : vocab.assets.slice(0, 2);

  const facts: StoreFact[] = [];
  for (const asset of subjects) {
    const st = getTokenFactorState(db, { asset, asOf: anchor.as_of }) as { percentiles?: { stream: string; source: string; window_id: string; percentile: number | null; value: number | null; status: string }[] };
    for (const p of st.percentiles ?? []) {
      if (p.status !== "ok" || p.percentile == null) continue;
      facts.push({ ref: `pctl:${p.stream}/${p.source}/${asset}/${p.window_id}`, value: p.percentile, label: `${p.stream} ${asset} ${p.window_id} percentile` });
      if (p.window_id === "365d" && p.value != null) facts.push({ ref: `val:${p.stream}/${p.source}/${asset}`, value: p.value, label: `${p.stream} ${asset} latest reading` });
    }
  }
  const byRef = new Map(facts.map((f) => [f.ref, f]));
  const edges = ((getMechanism(db, { asOf: anchor.as_of }) as { edges?: { id: string; src: string; dst: string; polarity: string; mechanism: string }[] }).edges ?? []);
  const edgeIds = new Set(edges.map((e) => e.id));

  const res = await llm.generateJson({
    tier: "strong",
    system: SYSTEM,
    shapeHint: SHAPE,
    user: ["FACTS:", ...facts.map((f) => `  - ${f.ref} = ${f.value}  (${f.label})`), "MECHANISM EDGES:", ...edges.map((e) => `  - ${e.id}: ${e.src} ->(${e.polarity}) ${e.dst} — ${e.mechanism}`), "", "PASTED TEXT:", text].join("\n"),
    maxTokens: 2500,
    forbid: opts.forbid,
  });
  const parsed = extractedSchema.safeParse(res.data);
  if (!parsed.success) throw new Error("claim extraction output invalid (fail-closed)");

  const claims: CheckedClaim[] = parsed.data.claims.map((c) => {
    const evidence: string[] = [];
    let supported = 0;
    let contradicted = 0;
    for (const n of c.numbers) {
      const fact = n.ref ? byRef.get(n.ref) : undefined;
      if (!fact) continue; // unmapped or invented ref → contributes nothing
      if ([n.value, n.value / 100, n.value * 100].some((v) => close(v, fact.value))) {
        supported++;
        evidence.push(`${n.value} matches the store: ${fact.label} = ${fact.value} \`${fact.ref}\``);
      } else {
        contradicted++;
        evidence.push(`${n.value} disagrees with the store: ${fact.label} = ${fact.value} \`${fact.ref}\``);
      }
    }
    const verdict: Verdict = contradicted ? "contradicted" : supported ? "supported" : "unverifiable";
    const edgeOk = !!c.edge_id && edgeIds.has(c.edge_id);
    return {
      text: c.text,
      claimant: c.claimant,
      verdict,
      evidence,
      mechanism: c.causal ? (edgeOk ? "documented" : "undocumented") : "n/a",
      edgeId: edgeOk ? c.edge_id : null,
      advisory: !checkNonAdvisory(c.text).ok,
    };
  });

  const lines = ["## Claim check", "", `_Checked against the desk's store as of ${new Date(anchor.as_of).toISOString()}._`, ""];
  if (!claims.length) lines.push("No checkable factual or causal claims were found in the text.");
  claims.forEach((c, i) => {
    const shown = c.advisory ? "[a trade instruction — reported, not repeated or evaluated]" : `"${c.text}"`;
    lines.push(`**${i + 1}. ${c.verdict.toUpperCase()}** — ${shown}${c.claimant ? ` _(claimant: ${c.claimant})_` : ""}`);
    for (const e of c.evidence) lines.push(`   - ${e}`);
    if (c.verdict === "unverifiable") lines.push("   - The desk does not measure what this asserts, so it can neither support nor contradict it.");
    if (c.mechanism === "documented") lines.push(`   - Causal link matches a documented channel in the mechanism graph: \`${c.edgeId}\`.`);
    if (c.mechanism === "undocumented") lines.push("   - Causal link is NOT a documented channel in the mechanism graph — treat as the claimant's conjecture.");
  });
  lines.push("", "_Verdicts are arithmetic against measured data; they are not a judgement of the author, and not financial advice._");
  const rendered = lines.join("\n");
  assertNonAdvisory(rendered);

  return { asOf: anchor.as_of, claims, text: rendered, provider: res.provider };
}
