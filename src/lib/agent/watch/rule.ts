import { z } from "zod";
import type { DB } from "../../capture/db/client";
import { REGIME_KEYS } from "../../factors/regimes";
import { resolveComputedAnchor } from "../../tools/handlers";

/**
 * The watch rule DSL. A watch is a conjunction of conditions over the SAME derived
 * state the divergence engine produces — so evaluating one is pure arithmetic
 * (zero model calls) and a thousand idle watches cost nothing. A rule describes a
 * market STATE; it can never encode an instruction (non-advisory by construction).
 */

const percentileCond = z.object({
  type: z.literal("percentile"),
  stream: z.string().min(1),
  asset: z.string().min(1),
  source: z.string().min(1).optional(),
  window: z.enum(["90d", "365d", "full"]).default("365d"),
  op: z.enum(["gte", "lte"]),
  value: z.number().min(0).max(1),
});

const regimeCond = z.object({
  type: z.literal("regime"),
  regime_key: z.string().min(1),
  asset: z.string().min(1).optional(),
  equals: z.string().min(1),
});

const divergenceCond = z.object({
  type: z.literal("divergence"),
  kind: z.enum(["extreme_state", "broken_relationship"]).optional(),
  subject_includes: z.string().min(1).optional(),
});

const signatureCond = z.object({
  type: z.literal("signature"),
  key: z.enum(["leverage_led", "spot_led", "fragile"]),
  asset: z.string().min(1).optional(),
});

export const conditionSchema = z.discriminatedUnion("type", [percentileCond, regimeCond, divergenceCond, signatureCond]);

export const ruleSchema = z.object({
  all: z.array(conditionSchema).min(1).max(5),
  cooldown_hours: z.number().int().min(1).max(24 * 14).default(24),
});

export type Condition = z.infer<typeof conditionSchema>;
export type WatchRule = z.infer<typeof ruleSchema>;

const pct = (v: number) => `P${Math.round(v * 100)}`;

export function describeCondition(c: Condition): string {
  switch (c.type) {
    case "percentile":
      return `${c.stream}${c.source ? `/${c.source}` : ""} ${c.asset} is ${c.op === "gte" ? "at or above" : "at or below"} ${pct(c.value)} of its own ${c.window} history`;
    case "regime":
      return `${c.regime_key}${c.asset ? `[${c.asset}]` : ""} reads "${c.equals}"`;
    case "divergence":
      return `a ${c.kind ? c.kind.replace(/_/g, " ") : "divergence"} flag is fired${c.subject_includes ? ` on ${c.subject_includes}` : ""}`;
    case "signature":
      return `the ${c.key.replace(/_/g, "-")} structural signature is fired${c.asset ? ` for ${c.asset}` : ""}`;
  }
}

/** Deterministic echo of a rule — what the user confirms before a watch is saved. */
export function describeRule(rule: WatchRule): string {
  return `Alert when ${rule.all.map(describeCondition).join(" AND ")} (at most once per ${rule.cooldown_hours}h).`;
}

/** What the store can actually express right now — the compiler's closed vocabulary. */
export interface Vocabulary {
  streams: { stream: string; source: string; assets: string[] }[];
  regimes: { key: string; values: string[] }[];
  assets: string[];
}

export function loadVocabulary(db: DB, asOf?: number): Vocabulary {
  const anchor = resolveComputedAnchor(db, asOf);
  if (!anchor) return { streams: [], regimes: REGIME_KEYS.map((key) => ({ key, values: [] })), assets: [] };
  const rows = db
    .prepare("SELECT DISTINCT stream, source, asset FROM factor_percentiles WHERE as_of = ? AND status = 'ok'")
    .all(anchor.as_of) as { stream: string; source: string; asset: string }[];
  const byStream = new Map<string, { stream: string; source: string; assets: string[] }>();
  for (const r of rows) {
    const k = `${r.stream}|${r.source}`;
    if (!byStream.has(k)) byStream.set(k, { stream: r.stream, source: r.source, assets: [] });
    byStream.get(k)!.assets.push(r.asset);
  }
  const regimeRows = db.prepare("SELECT DISTINCT regime_key, regime_value FROM factor_regimes").all() as { regime_key: string; regime_value: string }[];
  const regimes = REGIME_KEYS.map((key) => ({ key, values: regimeRows.filter((r) => r.regime_key === key).map((r) => r.regime_value) }));
  return { streams: [...byStream.values()], regimes, assets: [...new Set(rows.map((r) => r.asset))].sort() };
}

/** Reject a (model-compiled) rule that references anything the store doesn't have. */
export function validateAgainstVocabulary(rule: WatchRule, vocab: Vocabulary): string[] {
  const problems: string[] = [];
  for (const c of rule.all) {
    if (c.type === "percentile") {
      const s = vocab.streams.filter((x) => x.stream === c.stream && (!c.source || x.source === c.source));
      if (!s.length) problems.push(`unknown stream "${c.stream}${c.source ? `/${c.source}` : ""}"`);
      else if (!s.some((x) => x.assets.includes(c.asset))) problems.push(`no ${c.stream} history for asset "${c.asset}"`);
    } else if (c.type === "regime") {
      if (!vocab.regimes.some((r) => r.key === c.regime_key)) problems.push(`unknown regime "${c.regime_key}"`);
    }
  }
  return problems;
}
