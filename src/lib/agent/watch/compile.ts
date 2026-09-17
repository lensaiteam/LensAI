import { z } from "zod";
import { scrubIdentifiers } from "../privacy";
import type { JsonLlm } from "../llm/types";
import { describeRule, ruleSchema, validateAgainstVocabulary, type Vocabulary, type WatchRule } from "./rule";

/**
 * Compile a plain-language watch into the rule DSL with ONE small-model call.
 * The model only translates; the result is zod-validated, checked against the
 * store's closed vocabulary, and echoed back deterministically (describeRule) for
 * the user to confirm. After this, the watch never touches a model again.
 */

const compiledSchema = z.union([
  z.object({ ok: z.literal(true), rule: ruleSchema }),
  z.object({ ok: z.literal(false), reason: z.string().min(1) }),
]);

export type CompileResult =
  | { ok: true; rule: WatchRule; description: string; provider: string }
  | { ok: false; reason: string };

const SHAPE = `{"ok": true, "rule": {"all": [<condition>, ... up to 5], "cooldown_hours": 24}}
  or {"ok": false, "reason": "<why this cannot be expressed>"}
<condition> is exactly one of:
  {"type":"percentile","stream":"<stream>","asset":"<ASSET>","source":"<optional source>","window":"90d"|"365d"|"full","op":"gte"|"lte","value":<0..1>}
  {"type":"regime","regime_key":"<key>","asset":"<optional ASSET>","equals":"<value>"}
  {"type":"divergence","kind":"extreme_state"|"broken_relationship" (optional),"subject_includes":"<optional text>"}
  {"type":"signature","key":"leverage_led"|"spot_led"|"fragile","asset":"<optional ASSET>"}`;

function buildSystem(vocab: Vocabulary): string {
  return [
    "You translate a user's plain-language market WATCH into a structured rule for LensAI, a non-advisory crypto research desk.",
    "A rule is a conjunction of conditions over measured market STATE. Percentiles are 0..1 against the stream's OWN history:",
    '"extreme"/"stretched"/"very high" = gte 0.95; "very low" = lte 0.05; "high"/"elevated" = gte 0.8; "low" = lte 0.2; "not following"/"muted" = lte 0.6.',
    "Default window is 365d. Use ONLY the vocabulary below — never invent a stream, asset or regime.",
    "If the request asks for a price level, a trade instruction, or anything the vocabulary cannot express, return ok:false with a short reason.",
    "",
    "STREAMS (stream/source: assets):",
    ...vocab.streams.map((s) => `  - ${s.stream}/${s.source}: ${s.assets.join(", ")}`),
    "REGIMES (key: values):",
    ...vocab.regimes.map((r) => `  - ${r.key}: ${r.values.join(", ") || "(none computed yet)"}`),
  ].join("\n");
}

export async function compileWatch(llm: JsonLlm, text: string, vocab: Vocabulary, forbid: string[] = []): Promise<CompileResult> {
  if (!vocab.streams.length) return { ok: false, reason: "No factor state has been computed yet, so there is nothing to watch." };

  const res = await llm.generateJson({ tier: "small", system: buildSystem(vocab), shapeHint: SHAPE, user: `WATCH: ${scrubIdentifiers(text).slice(0, 500)}`, maxTokens: 800, forbid });
  const parsed = compiledSchema.safeParse(res.data);
  if (!parsed.success) return { ok: false, reason: "The watch could not be translated into a rule. Try naming the factor and asset (e.g. \"BTC funding extreme while basis stays low\")." };
  if (!parsed.data.ok) return { ok: false, reason: parsed.data.reason };

  const problems = validateAgainstVocabulary(parsed.data.rule, vocab);
  if (problems.length) return { ok: false, reason: `That watch references data the desk doesn't have: ${problems.join("; ")}.` };
  return { ok: true, rule: parsed.data.rule, description: describeRule(parsed.data.rule), provider: res.provider };
}
