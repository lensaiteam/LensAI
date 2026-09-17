import { z } from "zod";
import { PoolExhaustedError, type JsonLlm } from "./llm/types";

/**
 * Question planning. The agent never runs an open tool loop (free models are
 * unreliable at that); it PLANS once, then gathers deterministically through the
 * point-in-time tool layer. Cheap regex heuristics answer the common shapes with
 * zero model calls; only genuinely ambiguous questions spend a small-model call,
 * and if the pool is exhausted the heuristic guess is used.
 */

export const INTENTS = ["market", "token", "incident", "mechanism", "changes", "track_record", "advice", "out_of_scope"] as const;
export type Intent = (typeof INTENTS)[number];

export const planSchema = z.object({
  intent: z.enum(INTENTS),
  assets: z.array(z.string().min(1).max(12)).max(3).default([]),
  /** The specific angle asked about; null = a generic read (servable from the shared brief). */
  focus: z.string().max(300).nullable().default(null),
  since_hours: z.number().positive().max(24 * 90).nullable().default(null),
});
export type Plan = z.infer<typeof planSchema>;

const NAMES: Record<string, string> = {
  bitcoin: "BTC", btc: "BTC", ethereum: "ETH", ether: "ETH", eth: "ETH", solana: "SOL", sol: "SOL",
  ripple: "XRP", xrp: "XRP", dogecoin: "DOGE", doge: "DOGE", cardano: "ADA", ada: "ADA", bnb: "BNB",
  avalanche: "AVAX", avax: "AVAX", chainlink: "LINK", link: "LINK", dollar: "DXY", dxy: "DXY",
};

export function findAssets(question: string, known: string[]): string[] {
  const knownSet = new Set(known.map((a) => a.toUpperCase()));
  const out: string[] = [];
  for (const raw of question.split(/[^A-Za-z0-9$]+/)) {
    const w = raw.replace(/^\$/, "");
    if (!w) continue;
    const viaName = NAMES[w.toLowerCase()];
    // Bare uppercase tickers only count if the store knows them ("AND", "THE" are not assets).
    const sym = viaName ?? (w === w.toUpperCase() && /^[A-Z]{2,6}$/.test(w) && knownSet.has(w) ? w : null);
    if (sym && (knownSet.size === 0 || knownSet.has(sym)) && !out.includes(sym)) out.push(sym);
  }
  return out.slice(0, 3);
}

const RE = {
  advice: /\b(should|shall|can|do)\s+(i|we)\b.*\b(buy|sell|hold|short|long|invest|ape|enter|exit|accumulate|dca)\b|\b(good|right|best)\s+(time|moment|entry)\b|\bprice (prediction|target)\b|\bwill\b.*\b(reach|hit|moon|pump|crash|go up|go down)\b|\b(how much|what) should i\b|\bworth (buying|investing)\b/i,
  changes: /\bwhat(?:'s| is| has)?\s+changed\b|\bsince (i|my) last\b|\bcatch me up\b|\bwhat did i miss\b|\bany(thing)? new\b/i,
  track: /\btrack record\b|\bhow (accurate|reliable)\b|\bcalibration\b|\bwere you (right|wrong)\b|\bpast (calls|briefs|flags)\b/i,
  incident: /\bwhat (broke|happened)\b|\bpost.?mortem\b|\bincident\b|\b(crash|cascade|depeg|liquidat\w*|wipe.?out|blow.?up)\b|\bwhy did\b.*\b(dump|crash|drop|fall|spike|tank)\b/i,
  mechanism: /\bhow (does|do|would|could)\b|\btransmi\w*\b|\bchannel\b|\bmechanism\b|\b(affect|impact|feed into|drive)s?\b/i,
  genericMarket: /^\W*(?:(?:what(?:'s| is)|how(?:'s| is)|give me|show me)\s+)?(?:the\s+)?(?:current\s+)?(?:crypto\s+)?(?:market(?:\s+(?:state|read|structure|brief|doing|looking|overview))?|state of the market|market state)\W*$/i,
  since: /\b(?:last|past)\s+(\d+)\s*(h|hr|hrs|hour|hours|d|day|days|w|week|weeks)\b/i,
};

function sinceHours(q: string): number | null {
  const m = RE.since.exec(q);
  if (!m) return /\b(today|24h)\b/i.test(q) ? 24 : /\bthis week\b/i.test(q) ? 168 : null;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  return u.startsWith("h") ? n : u.startsWith("d") ? n * 24 : n * 168;
}

export interface HeuristicPlan { plan: Plan; confident: boolean }

export function planHeuristic(question: string, knownAssets: string[], previousAssets: string[] = []): HeuristicPlan {
  const q = question.trim();
  const found = findAssets(q, knownAssets);
  const assets = found.length ? found : previousAssets.slice(0, 3);
  const base = { assets, focus: null as string | null, since_hours: sinceHours(q) };

  if (RE.advice.test(q)) return { plan: { ...base, intent: "advice" }, confident: true };
  if (RE.changes.test(q)) return { plan: { ...base, intent: "changes" }, confident: true };
  if (RE.track.test(q)) return { plan: { ...base, intent: "track_record" }, confident: true };
  if (RE.genericMarket.test(q)) return { plan: { ...base, assets: [], intent: "market" }, confident: true };

  // A bare asset mention ("SOL?", "brief on ETH", "how is bitcoin") is a generic token read.
  const stripped = q.replace(/\b(brief(ing)?|read|state|update|overview|on|of|for|the|how|is|how's|what|about|what's|up|with|doing|looking|give|me|a|an|show|\$)\b/gi, "");
  const residue = stripped.split(/[^A-Za-z0-9]+/).filter((w) => w && !found.includes(NAMES[w.toLowerCase()] ?? w.toUpperCase()));
  if (found.length === 1 && residue.length === 0) return { plan: { ...base, intent: "token" }, confident: true };

  if (RE.incident.test(q)) return { plan: { ...base, intent: "incident", focus: q }, confident: found.length > 0 };
  if (RE.mechanism.test(q)) return { plan: { ...base, intent: "mechanism", focus: q }, confident: false };
  // Unsure: best guess for when the pool can't be consulted.
  return { plan: { ...base, intent: assets.length ? "token" : "market", focus: q }, confident: false };
}

const SHAPE = `{"intent": "market"|"token"|"incident"|"mechanism"|"changes"|"track_record"|"advice"|"out_of_scope", "assets": ["<SYMBOL>", ... max 3], "focus": "<the specific angle asked about, or null for a generic read>", "since_hours": <number or null>}`;

const SYSTEM = [
  "You route a user's question for LensAI, a NON-ADVISORY crypto research desk that reads funding, basis, macro, flows, depth and news together.",
  "Intents: market (whole-market structure) · token (one or more tokens in market context) · incident (what broke / post-mortem) ·",
  "mechanism (how a transmission channel works) · changes (what changed over a period) · track_record (the desk's own past output) ·",
  "advice (the user asks what to DO: buy/sell/hold/allocate/price prediction) · out_of_scope (not about crypto market structure).",
  "Use only asset symbols from KNOWN ASSETS. `focus` restates the specific angle in a few words, or null if it is just a general read.",
].join("\n");

export async function planQuestion(llm: JsonLlm, question: string, opts: { knownAssets: string[]; previousAssets?: string[]; history?: string[]; forbid?: string[] }): Promise<{ plan: Plan; via: "heuristic" | "model" | "heuristic-fallback"; llmCalls: number }> {
  const h = planHeuristic(question, opts.knownAssets, opts.previousAssets);
  if (h.confident) return { plan: h.plan, via: "heuristic", llmCalls: 0 };

  try {
    const res = await llm.generateJson({
      tier: "small",
      system: SYSTEM,
      shapeHint: SHAPE,
      user: [`KNOWN ASSETS: ${opts.knownAssets.join(", ") || "(none)"}`, ...(opts.history?.length ? [`EARLIER QUESTIONS: ${opts.history.slice(-2).join(" | ")}`] : []), `QUESTION: ${question}`].join("\n"),
      maxTokens: 300,
      forbid: opts.forbid,
    });
    const parsed = planSchema.safeParse(res.data);
    if (!parsed.success) return { plan: h.plan, via: "heuristic-fallback", llmCalls: 1 };
    const known = new Set(opts.knownAssets.map((a) => a.toUpperCase()));
    const assets = parsed.data.assets.map((a) => a.toUpperCase()).filter((a) => known.has(a));
    return { plan: { ...parsed.data, assets, focus: parsed.data.focus ?? (parsed.data.intent === "token" || parsed.data.intent === "market" ? null : question) }, via: "model", llmCalls: 1 };
  } catch (e) {
    if (e instanceof PoolExhaustedError) return { plan: h.plan, via: "heuristic-fallback", llmCalls: 0 };
    throw e;
  }
}
