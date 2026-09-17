import type { DB } from "../capture/db/client";
import { StoreClaimVerifier } from "../guardrails/verifier";
import { checkNonAdvisory, assertNonAdvisory } from "../guardrails/outputFilter";
import { briefSchema, type Claim, type Surface } from "./schema";
import { buildSystemPrompt } from "./prompt";
import { gatherMarket, gatherToken, gatherIncident, type GatheredContext } from "./gather";
import { renderBrief } from "./render";
import type { LlmProvider } from "./provider";

/**
 * The narration pipeline — FAIL-CLOSED at every gate:
 *   gather (point-in-time) → generate (structured) → verify (numbers resolve)
 *   → guardrail (non-advisory) → render → final guardrail.
 * A claim that trips any gate is DROPPED (not softened); the audit records why.
 */

export interface ClaimAudit {
  text: string;
  basis: Claim["basis"];
  kept: boolean;
  reason?: string;
  refs: string[];
}

export interface NarrateResult {
  surface: Surface;
  asset?: string;
  asOf: number;
  text: string;
  audit: ClaimAudit[];
  kept: number;
  dropped: number;
  provider: string;
}

export interface NarrateOptions {
  surface: Surface;
  asset?: string;
  asOf?: number;
}

/** Durations/window names ("365-day", "90d", "24h") are labels, not numeric claims. */
const DURATION_AFTER = /^\s?-?(?:d|day|days|h|hr|hour|hours|w|week|weeks|month|months|y|yr|year|years)\b/i;

/**
 * Numbers written into a claim's TEXT must be declared in its `numbers` (and so
 * verified) — otherwise a model could state "94th percentile" in prose with an
 * empty numbers array and bypass INV-4. Matches value, value*100 and value/100.
 */
export function undeclaredNumber(c: Claim): number | null {
  const re = /\d+(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(c.text))) {
    if (DURATION_AFTER.test(c.text.slice(m.index + m[0].length))) continue;
    const v = Number(m[0]);
    const declared = c.numbers.some((n) => [n.value, n.value * 100, n.value / 100].some((x) => Math.abs(x - v) <= Math.max(1e-9, 0.01 * Math.abs(v))));
    if (!declared) return v;
  }
  return null;
}

/**
 * The fail-closed claim gates, shared by scheduled narration and the agent's
 * question answering. A claim that trips any gate is DROPPED (never softened).
 */
export async function auditClaims(claims: Claim[], ctx: Pick<GatheredContext, "facts" | "edgeIds">): Promise<{ kept: Claim[]; audit: ClaimAudit[] }> {
  const verifier = new StoreClaimVerifier(ctx.facts);
  const audit: ClaimAudit[] = [];
  const kept: Claim[] = [];

  for (const c of claims) {
    // 1. Non-advisory.
    const g = checkNonAdvisory(c.text);
    if (!g.ok) {
      audit.push({ text: c.text, basis: c.basis, kept: false, reason: `advisory:${g.violations[0].rule}`, refs: c.refs });
      continue;
    }
    // 2. Every numeric claim must resolve to a store row — including numbers
    //    that only appear in the prose.
    if (undeclaredNumber(c) !== null) {
      audit.push({ text: c.text, basis: c.basis, kept: false, reason: "undeclared-number", refs: c.refs });
      continue;
    }
    let numsOk = true;
    const refs = [...c.refs];
    for (const n of c.numbers) {
      const r = await verifier.verify(n);
      if (!r.resolved) { numsOk = false; break; }
      refs.push(...r.storeRefs);
    }
    if (!numsOk) {
      audit.push({ text: c.text, basis: c.basis, kept: false, reason: "unverified-number", refs: c.refs });
      continue;
    }
    // 3. A mechanical claim must cite a real mechanism edge.
    if (c.basis === "mechanical" && !c.refs.some((r) => ctx.edgeIds.has(r))) {
      audit.push({ text: c.text, basis: c.basis, kept: false, reason: "mechanical-no-edge", refs: c.refs });
      continue;
    }
    kept.push({ ...c, refs });
    audit.push({ text: c.text, basis: c.basis, kept: true, refs });
  }
  return { kept, audit };
}

export async function narrate(db: DB, provider: LlmProvider, opts: NarrateOptions): Promise<NarrateResult> {
  const asOf = opts.asOf ?? Date.now();
  if (opts.surface === "token" && !opts.asset) throw new Error("token narration requires an asset");
  const ctx: GatheredContext =
    opts.surface === "market" ? gatherMarket(db, asOf)
    : opts.surface === "incident" ? gatherIncident(db, opts.asset, asOf)
    : gatherToken(db, opts.asset!, asOf);

  const raw = await provider.generate({ system: buildSystemPrompt(opts.surface), context: ctx.contextText });

  // Structured-output validation: malformed/hallucinated shape fails closed.
  const parsed = briefSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`narration output invalid (fail-closed): ${parsed.error.issues[0]?.message}`);
  const brief = parsed.data;

  const { kept, audit } = await auditClaims(brief.claims, ctx);

  const text = renderBrief({ headline: brief.headline, claims: kept }, { surface: opts.surface, asset: opts.asset, asOf });
  // Belt-and-suspenders: the assembled text must pass the guardrail too.
  assertNonAdvisory(text);

  return {
    surface: opts.surface,
    asset: opts.asset,
    asOf,
    text,
    audit,
    kept: kept.length,
    dropped: brief.claims.length - kept.length,
    provider: provider.name,
  };
}
