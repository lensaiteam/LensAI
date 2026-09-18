import type { DB } from "../capture/db/client";
import { assertNonAdvisory } from "../guardrails/outputFilter";
import { gatherIncident, gatherMarket, gatherToken, type GatheredContext } from "../narrate/gather";
import { auditClaims, narrate, type ClaimAudit } from "../narrate/orchestrator";
import { NARRATE_CODE_VERSION, persistBrief } from "../narrate/briefs";
import { buildSystemPrompt } from "../narrate/prompt";
import type { LlmProvider, NarrateRequest } from "../narrate/provider";
import { renderBrief } from "../narrate/render";
import { briefSchema, type Surface } from "../narrate/schema";
import { resolveComputedAnchor } from "../tools/handlers";
import { computeChanges } from "./changes";
import { PoolExhaustedError, type JsonLlm } from "./llm/types";
import { planQuestion, type Intent, type Plan } from "./plan";
import { scrubIdentifiers } from "./privacy";
import { loadVocabulary } from "./watch/rule";

/**
 * Answer one question. Shape: plan → gather (deterministic, point-in-time) →
 * ONE structured generation → the same fail-closed gates as scheduled narration
 * (numbers resolve, mechanical claims cite a real edge, non-advisory) → render.
 *
 * Model-call economics: generic reads are served from the shared per-anchor brief
 * (market state is identical for every user, so it is generated once); "what
 * changed" and the track record are pure arithmetic; and when the pool is
 * exhausted the agent degrades to the measured state rather than failing.
 */

export const BRIEF_SHAPE = `{"headline": "<short title>", "claims": [{"text": "<one atomic assertion>", "basis": "measured"|"mechanical"|"conjecture", "refs": ["<store ref or mechanism edge id>"], "numbers": [{"value": <number>, "unit": "<optional>", "ref": "<store ref>"}]}]}`;

/** Adapts the pooled JSON LLM to narration's provider seam. */
export class PoolNarrateProvider implements LlmProvider {
  private last = "none";
  constructor(private readonly llm: JsonLlm, private readonly opts: { exclude?: string[]; forbid?: string[] } = {}) {}
  get name(): string { return `pool:${this.last}`; }
  get lastProvider(): string { return this.last; }
  async generate(req: NarrateRequest): Promise<unknown> {
    const res = await this.llm.generateJson({ tier: "strong", system: req.system, user: req.context, shapeHint: BRIEF_SHAPE, maxTokens: 4000, exclude: this.opts.exclude, forbid: this.opts.forbid });
    this.last = res.provider;
    return res.data;
  }
}

export type Stage = "planning" | "gathering" | "generating" | "verifying" | "done";

export interface AskInput {
  question: string;
  /** Earlier user questions in this conversation (already stored scrubbed or not — scrubbed again here). */
  history?: string[];
  previousAssets?: string[];
  /** For "what changed": the anchor the user last viewed. */
  lastSeenAsOf?: number | null;
  /** This user's identifiers — the router refuses any prompt containing one. */
  forbid?: string[];
  now?: number;
  onStage?: (stage: Stage, detail?: Record<string, unknown>) => void;
}

export interface AskResult {
  intent: Intent;
  assets: string[];
  asOf: number | null;
  text: string;
  audit: ClaimAudit[];
  provider: string | null;
  /** Served from the shared per-anchor brief (no model call for this user). */
  shared: boolean;
  /** The pool was unavailable/unusable; the measured state was returned instead. */
  degraded: boolean;
  llmCalls: number;
}

const ADVICE_PREFACE = "LensAI is a research desk: it describes market structure and never says what to do with it. Here is the structure relevant to the question.";
const OUT_OF_SCOPE = "That is outside what the desk reads. LensAI covers crypto market structure — funding, basis and yield, macro, flows, depth and news — for the market as a whole, a single token in that context, and post-mortems when something breaks.";

const surfaceFor = (intent: Intent): Surface => (intent === "incident" ? "incident" : intent === "token" ? "token" : "market");

function gatherFor(db: DB, plan: Plan, surface: Surface, asOf: number): GatheredContext {
  if (surface === "incident") return gatherIncident(db, plan.assets[0], asOf);
  if (surface === "market" || !plan.assets.length) return gatherMarket(db, asOf);
  const parts = plan.assets.map((a) => gatherToken(db, a, asOf));
  if (parts.length === 1) return parts[0];
  // Comparison: union of the per-token contexts (facts keep their per-asset refs).
  return {
    ...parts[0],
    asset: plan.assets.join(","),
    facts: parts.flatMap((p) => p.facts),
    edgeIds: new Set(parts.flatMap((p) => [...p.edgeIds])),
    contextText: parts.map((p, i) => (i === 0 ? p.contextText : p.contextText.split("\nMARKET CONTEXT:")[0])).join("\n\n"),
  };
}

/** Zero-model fallback: the measured facts themselves, plainly. */
export function renderMeasured(ctx: GatheredContext, asOf: number, note: string): string {
  const lines = [`## Measured state${ctx.asset ? ` — ${ctx.asset}` : ""}`, "", `_${note}_`, ""];
  if (ctx.facts.length) for (const f of ctx.facts.slice(0, 24)) lines.push(`- ${f.label ?? f.ref}: P${Math.round(f.value * 100)} \`${f.ref}\``);
  else lines.push("No measured values are available at this anchor.");
  lines.push("", `_As of ${new Date(asOf).toISOString()}. Percentiles are against each stream's own history. Not financial advice._`);
  return lines.join("\n");
}

function sharedBrief(db: DB, surface: Surface, asset: string | undefined, asOf: number): { text: string; provider: string; audit: ClaimAudit[] } | null {
  const row = db
    .prepare(`SELECT text, provider, audit FROM briefs WHERE surface = ? AND asset IS ? AND as_of = ? AND code_version = ? AND claims_kept > 0 ORDER BY id DESC LIMIT 1`)
    .get(surface, asset ?? null, asOf, NARRATE_CODE_VERSION) as { text: string; provider: string; audit: string } | undefined;
  return row ? { text: row.text, provider: row.provider, audit: JSON.parse(row.audit) as ClaimAudit[] } : null;
}

function trackRecord(db: DB): string {
  const rows = db.prepare("SELECT surface, COUNT(*) AS n, SUM(claims_kept) AS kept, SUM(claims_dropped) AS dropped, MIN(created_at) AS first, MAX(created_at) AS last FROM briefs GROUP BY surface").all() as { surface: string; n: number; kept: number; dropped: number; first: number; last: number }[];
  if (!rows.length) return "The calibration record is empty — no briefs have been filed yet.";
  const day = (t: number) => new Date(t).toISOString().slice(0, 10);
  const lines = ["## The desk's record", "", "Every brief the desk files is appended to an immutable calibration record, including the claims it had to drop.", ""];
  for (const r of rows) {
    const total = r.kept + r.dropped;
    lines.push(`- **${r.surface}**: ${r.n} briefs filed ${day(r.first)} → ${day(r.last)}; ${r.kept} of ${total} generated claims survived verification (${total ? Math.round((100 * r.kept) / total) : 0}%).`);
  }
  lines.push("", "_A dropped claim is one that failed numeric verification, cited no real mechanism, or read as advice. Outcome scoring of flags is not computed yet._");
  return lines.join("\n");
}

export async function askAgent(deps: { db: DB; llm: JsonLlm }, input: AskInput): Promise<AskResult> {
  const { db, llm } = deps;
  const now = input.now ?? Date.now();
  const stage = input.onStage ?? (() => {});
  const question = scrubIdentifiers(input.question).trim().slice(0, 1000);
  const base = { assets: [] as string[], asOf: null as number | null, audit: [] as ClaimAudit[], provider: null as string | null, shared: false, degraded: false, llmCalls: 0 };

  stage("planning");
  const vocab = loadVocabulary(db, now);
  const planned = await planQuestion(llm, question, { knownAssets: vocab.assets, previousAssets: input.previousAssets, history: input.history?.map(scrubIdentifiers), forbid: input.forbid });
  const plan = planned.plan;
  let llmCalls = planned.llmCalls;

  if (plan.intent === "out_of_scope") return { ...base, intent: plan.intent, text: OUT_OF_SCOPE, llmCalls };
  if (plan.intent === "track_record") return { ...base, intent: plan.intent, text: trackRecord(db), llmCalls };
  if (plan.intent === "changes") {
    const since = plan.since_hours ? now - plan.since_hours * 3_600_000 : (input.lastSeenAsOf ?? now - 86_400_000);
    const ch = computeChanges(db, { since, asOf: now, assets: plan.assets });
    return { ...base, intent: plan.intent, assets: plan.assets, asOf: ch.to?.as_of ?? null, text: ch.text, llmCalls };
  }

  const anchor = resolveComputedAnchor(db, now);
  if (!anchor) return { ...base, intent: plan.intent, assets: plan.assets, text: "The desk has not computed any factor state yet, so there is nothing to read.", llmCalls };

  // An advice question is answered with the structure, never the action.
  const intent: Intent = plan.intent === "advice" ? (plan.assets.length ? "token" : "market") : plan.intent;
  const focus = plan.intent === "advice" ? null : plan.focus;
  const surface = surfaceFor(intent);
  const asset = surface === "market" ? undefined : plan.assets[0];
  const preface = plan.intent === "advice" ? `${ADVICE_PREFACE}\n\n` : "";
  const out = (r: Partial<AskResult> & { text: string }): AskResult => {
    const text = preface + r.text;
    assertNonAdvisory(text);
    stage("done");
    return { ...base, intent: plan.intent, assets: plan.assets, asOf: anchor.as_of, llmCalls, ...r, text };
  };

  stage("gathering", { surface, assets: plan.assets, asOf: anchor.as_of });
  const ctx = gatherFor(db, { ...plan, intent }, surface, anchor.as_of);

  // Generic single-subject read → the shared per-anchor brief.
  if (!focus && plan.assets.length <= 1 && (surface !== "token" || asset)) {
    const hit = sharedBrief(db, surface, asset, anchor.as_of);
    if (hit) return out({ text: hit.text, audit: hit.audit, provider: hit.provider, shared: true });
    try {
      stage("generating");
      const provider = new PoolNarrateProvider(llm, { forbid: input.forbid });
      llmCalls++;
      const res = await narrate(db, provider, { surface, asset, asOf: anchor.as_of });
      if (res.kept > 0) {
        persistBrief(db, res, now); // user-agnostic: safe for the append-only record
        return out({ text: res.text, audit: res.audit, provider: res.provider });
      }
      return out({ text: renderMeasured(ctx, anchor.as_of, "No generated claim survived verification; showing the measured state."), audit: res.audit, provider: res.provider, degraded: true });
    } catch (e) {
      return out({ text: renderMeasured(ctx, anchor.as_of, e instanceof PoolExhaustedError ? "The desk's narration capacity is exhausted right now; showing the measured state." : "Narration failed verification; showing the measured state."), degraded: true });
    }
  }

  // Question-specific generation. NOT persisted to `briefs`: it derives from a
  // user's question, and user data never enters the append-only record.
  const system = [
    buildSystemPrompt(surface),
    "",
    "You are answering a specific QUESTION. Answer it using ONLY the context. If the context cannot answer part of it,",
    "say so plainly in a conjecture claim (what the desk does not measure) rather than guessing. 4–8 atomic claims.",
  ].join("\n");
  const user = `${ctx.contextText}\n\nQUESTION: ${focus ?? question}`;
  const exclude: string[] = [];
  let lastAudit: ClaimAudit[] = [];
  let lastProvider: string | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      stage("generating", { attempt });
      llmCalls++;
      const res = await llm.generateJson({ tier: "strong", system, user, shapeHint: BRIEF_SHAPE, maxTokens: 4000, exclude: [...exclude], forbid: input.forbid });
      lastProvider = `pool:${res.provider}`;
      exclude.push(res.provider); // a failed verification retries on a DIFFERENT provider
      const parsed = briefSchema.safeParse(res.data);
      if (!parsed.success) continue;
      stage("verifying");
      const { kept, audit } = await auditClaims(parsed.data.claims, ctx);
      lastAudit = audit;
      if (!kept.length) continue;
      const text = renderBrief({ headline: parsed.data.headline, claims: kept }, { surface, asset: ctx.asset, asOf: anchor.as_of });
      return out({ text, audit, provider: lastProvider });
    } catch (e) {
      if (e instanceof PoolExhaustedError) { llmCalls--; break; }
      throw e;
    }
  }
  return out({ text: renderMeasured(ctx, anchor.as_of, "The desk could not produce a verified answer to that question; showing the measured state it would have drawn on."), audit: lastAudit, provider: lastProvider, degraded: true });
}
