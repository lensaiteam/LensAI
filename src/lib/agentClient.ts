"use client";
import type { ClaimAudit } from "@/lib/narrate/orchestrator";
import type { ChangeSet } from "@/lib/agent/changes";
import type { CheckedClaim } from "@/lib/agent/claimcheck";
import type { WatchRule } from "@/lib/agent/watch/rule";
import type { ApiKeyRecord, ClaimCheckRecord, Conversation, Message, Prefs, Watch, WatchTrigger } from "@/lib/agent/store/types";

/**
 * Browser client for the agent service. The session cookie never leaves this
 * origin: the site mints a short-lived, audience-bound token (/api/agent/token)
 * and the browser talks to the service directly with it, so long answers can
 * stream over SSE. The token is cached and renewed a minute before it expires.
 */

export type { ChangeSet, CheckedClaim, WatchRule, ApiKeyRecord, ClaimCheckRecord, Conversation, Message, Prefs, Watch, WatchTrigger, ClaimAudit };

export type Stage = "planning" | "gathering" | "generating" | "verifying" | "done";
export const STAGES: Stage[] = ["planning", "gathering", "generating", "verifying", "done"];

export interface AskAnswer {
  conversationId: string;
  messageId: string | null;
  intent: string;
  assets: string[];
  asOf: number | null;
  text: string;
  audit: ClaimAudit[];
  provider: string | null;
  shared: boolean;
  degraded: boolean;
  llmCalls: number;
  budgetExhausted: boolean;
}

export interface AnswerMeta {
  intent?: string;
  assets?: string[];
  asOf?: number | null;
  provider?: string | null;
  shared?: boolean;
  degraded?: boolean;
  audit?: ClaimAudit[];
  budgetExhausted?: boolean;
}

export type CompileResult = { ok: true; rule: WatchRule; description: string; provider: string } | { ok: false; reason: string };
export interface ClaimCheckResponse { id: string | null; asOf: number | null; claims: CheckedClaim[]; text: string; provider: string | null }
export interface Usage { day: string; used: number; limit: number }

export class AgentError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface TokenCache { token: string; agentUrl: string | null; exp: number }
let cache: TokenCache | null = null;

async function getToken(force = false): Promise<TokenCache> {
  if (!force && cache && cache.exp - Date.now() > 60_000) return cache;
  const res = await fetch("/api/agent/token", { cache: "no-store" });
  if (!res.ok) throw new AgentError(res.status, res.status === 401 ? "Your session has ended. Sign in again." : "The site could not issue a desk token.");
  const j = (await res.json()) as { token: string; expiresInSec: number; agentUrl: string | null };
  cache = { token: j.token, agentUrl: j.agentUrl, exp: Date.now() + j.expiresInSec * 1000 };
  return cache;
}

const NOT_CONFIGURED = "The desk service is not configured for this site yet.";

async function authed(path: string, init: { method?: string; body?: unknown; accept?: string } = {}): Promise<Response> {
  let t = await getToken();
  if (!t.agentUrl) throw new AgentError(0, NOT_CONFIGURED);
  const go = (tok: string) =>
    fetch(t.agentUrl + path, {
      method: init.method ?? "GET",
      headers: { authorization: `Bearer ${tok}`, "content-type": "application/json", accept: init.accept ?? "application/json" },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  let res = await go(t.token);
  if (res.status === 401) {
    t = await getToken(true);
    res = await go(t.token);
  }
  return res;
}

/** JSON request to the service; throws AgentError with the service's message. */
export async function agentFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  if (preview) return previewFetch<T>(path, init);
  const res = await authed(path, init);
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new AgentError(res.status, j.error ?? `The desk returned ${res.status}.`);
  return j as T;
}

/** POST /v1/ask over SSE: stage events as they happen, then the answer. */
export async function agentAsk(body: { question: string; conversationId?: string }, onStage: (stage: Stage) => void): Promise<AskAnswer> {
  if (preview) return previewAsk(body, onStage);
  const res = await authed("/v1/ask", { method: "POST", body, accept: "text/event-stream" });
  if (!res.ok || !res.body) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new AgentError(res.status, j.error ?? `The desk returned ${res.status}.`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let answer: AskAnswer | null = null;
  let failure: string | null = null;
  const handle = (chunk: string) => {
    let event = "message";
    const data: string[] = [];
    for (const line of chunk.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trim());
    }
    if (!data.length) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(data.join("\n"));
    } catch {
      return;
    }
    if (event === "stage") onStage((parsed as { stage: Stage }).stage);
    else if (event === "answer") answer = parsed as AskAnswer;
    else if (event === "error") failure = (parsed as { error?: string }).error ?? "The desk could not answer.";
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) !== -1) {
      handle(buf.slice(0, i));
      buf = buf.slice(i + 2);
    }
  }
  if (buf.trim()) handle(buf);
  if (failure) throw new AgentError(0, failure);
  if (!answer) throw new AgentError(0, "The stream ended without an answer.");
  return answer;
}

// ── Development preview ──────────────────────────────────────────────────────
// /app?preview=desk renders the desk on a specimen fixture so it can be styled
// without a wallet session or a running service. Every value below is obviously
// synthetic and the page labels it as such. Unreachable in production.

let preview = false;
export function enablePreview(): void {
  if (process.env.NODE_ENV === "development") preview = true;
}
export const isPreview = (): boolean => preview;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const T0 = Date.UTC(2026, 8, 18, 4, 0, 0);
const HOUR = 3_600_000;

const SPEC_AUDIT: ClaimAudit[] = [
  { text: "BTC funding sits at the 94th percentile of its 365-day range.", basis: "measured", kept: true, refs: ["pctl:funding_rate/binance/BTC/365d"] },
  { text: "Open interest is at the 91st percentile over the same window.", basis: "measured", kept: true, refs: ["pctl:open_interest/binance/BTC/365d"] },
  { text: "Elevated funding draws basis-trade capital, which shorts perps and pushes funding back toward neutral.", basis: "mechanical", kept: true, refs: ["funding_to_basis", "basis_to_funding"] },
  { text: "Basis has followed funding up, to the 88th percentile.", basis: "measured", kept: false, reason: "unverified-number: store reads P42", refs: ["pctl:basis/binance/BTC/365d"] },
  { text: "The move reads as leverage-led rather than spot-led.", basis: "conjecture", kept: true, refs: [] },
];
const SPEC_TEXT = [
  "## Leverage is leading; spot is not confirming (specimen)",
  "",
  "BTC funding sits at the 94th percentile of its 365-day range. Open interest is at the 91st percentile over the same window. Elevated funding draws basis-trade capital, which shorts perps and pushes funding back toward neutral.",
  "",
  "Conjecture: The move reads as leverage-led rather than spot-led.",
  "",
  `_As of ${new Date(T0).toISOString()}._`,
  "",
  "_This is an assessment of current market structure, not financial advice. Crypto is highly volatile and you can lose money._",
].join("\n");

const SPEC_CONVS: Conversation[] = [
  { id: "11111111-1111-4111-8111-111111111111", title: "is BTC funding confirmed by open interest?", createdAt: T0 - 2 * HOUR, updatedAt: T0 - 2 * HOUR },
  { id: "22222222-2222-4222-8222-222222222222", title: "market state", createdAt: T0 - 26 * HOUR, updatedAt: T0 - 26 * HOUR },
];
const SPEC_WATCHES: Watch[] = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    wallet: "0x",
    text: "tell me when BTC funding is extreme but basis isn't following",
    rule: { all: [{ type: "percentile", stream: "funding_rate", asset: "BTC", source: "binance", window: "365d", op: "gte", value: 0.95 }, { type: "percentile", stream: "basis", asset: "BTC", source: "binance", window: "365d", op: "lte", value: 0.6 }], cooldown_hours: 24 },
    description: "funding_rate/binance BTC ≥ P95 (365d) AND basis/binance BTC ≤ P60 (365d); cooldown 24h",
    channel: "email",
    status: "active",
    lastState: false,
    lastEvaluatedAsOf: T0,
    lastFiredAt: null,
    createdAt: T0 - 50 * HOUR,
  },
];

async function previewFetch<T>(path: string, init: { method?: string; body?: unknown }): Promise<T> {
  await wait(260);
  const m = init.method ?? "GET";
  const out = (v: unknown) => v as T;
  if (path === "/v1/usage") return out({ day: new Date(T0).toISOString().slice(0, 10), used: 2, limit: 25 });
  if (path === "/v1/conversations") return out({ conversations: SPEC_CONVS });
  if (path.startsWith("/v1/conversations/") && m === "GET") {
    const id = path.split("/")[3];
    const messages: Message[] = [
      { id: "m1", conversationId: id, role: "user", content: SPEC_CONVS.find((c) => c.id === id)?.title ?? "market state", meta: null, createdAt: T0 - HOUR },
      { id: "m2", conversationId: id, role: "assistant", content: SPEC_TEXT, meta: { intent: "token", assets: ["BTC"], asOf: T0, provider: "pool:groq", shared: false, degraded: false, audit: SPEC_AUDIT }, createdAt: T0 - HOUR },
    ];
    return out({ messages });
  }
  if (path.startsWith("/v1/changes")) {
    const cs: ChangeSet = {
      from: { as_of: T0 - 24 * HOUR, slot: 1 },
      to: { as_of: T0, slot: 2 },
      flagsOpened: [{ kind: "extreme_state", subject: "market_depth/binance/BTC", window_id: "365d", direction: "low" }],
      flagsCleared: [{ kind: "broken_relationship", subject: "funding_to_basis[BTC]", window_id: "365d" }],
      regimeChanges: [{ regime_key: "vol", asset: "BTC", from: "low", to: "high" }],
      movers: [
        { stream: "funding_rate", source: "binance", asset: "BTC", from: 0.61, to: 0.94, delta: 0.33 },
        { stream: "open_interest", source: "bybit", asset: "ETH", from: 0.4, to: 0.71, delta: 0.31 },
        { stream: "market_depth", source: "binance", asset: "BTC", from: 0.32, to: 0.07, delta: -0.25 },
      ],
      text: "",
    };
    return out(cs);
  }
  if (path === "/v1/watches" && m === "GET") return out({ watches: SPEC_WATCHES });
  if (path === "/v1/watches/compile") {
    return out({ ok: true, rule: SPEC_WATCHES[0].rule, description: SPEC_WATCHES[0].description, provider: "groq" } satisfies CompileResult);
  }
  if (path === "/v1/watches" && m === "POST") return out({ watch: { ...SPEC_WATCHES[0], id: "44444444-4444-4444-8444-444444444444", createdAt: T0 } });
  if (path.startsWith("/v1/watches/") && path.endsWith("/triggers")) {
    const t: WatchTrigger[] = [{ id: "t1", watchId: SPEC_WATCHES[0].id, firedAt: T0 - 30 * HOUR, asOf: T0 - 30 * HOUR, message: "funding_rate/binance BTC = P96; basis/binance BTC = P41 (specimen)", delivered: true }];
    return out({ triggers: t });
  }
  if (path.startsWith("/v1/watches/") && m === "PATCH") return out({ watch: { ...SPEC_WATCHES[0], ...(init.body as object) } });
  if (path.startsWith("/v1/watches/") && m === "DELETE") return out({ deleted: true });
  if (path === "/v1/claim-check") {
    const claims: CheckedClaim[] = [
      { text: "BTC funding is at a yearly high", claimant: "@specimen", verdict: "supported", evidence: ["pctl:funding_rate/binance/BTC/365d = 0.94"], mechanism: "n/a", edgeId: null, advisory: false },
      { text: "basis is confirming the move", claimant: "@specimen", verdict: "contradicted", evidence: ["pctl:basis/binance/BTC/365d = 0.42 (claim implies ≥ 0.8)"], mechanism: "n/a", edgeId: null, advisory: false },
      { text: "so it's time to load up", claimant: "@specimen", verdict: "unverifiable", evidence: [], mechanism: "n/a", edgeId: null, advisory: true },
    ];
    return out({ id: null, asOf: T0, claims, text: "", provider: "pool:gemini" } satisfies ClaimCheckResponse);
  }
  if (path === "/v1/claim-checks") return out({ claimChecks: [] as ClaimCheckRecord[] });
  if (path === "/v1/prefs" && m === "GET") return out({ prefs: { watchlist: ["BTC", "ETH"], timezone: null, email: null, telegramChatId: null, lastSeenAsOf: T0 - 24 * HOUR } });
  if (path === "/v1/prefs" && m === "PUT") return out({ prefs: { watchlist: ["BTC", "ETH"], timezone: null, email: null, telegramChatId: null, lastSeenAsOf: T0, ...(init.body as object) } });
  if (path === "/v1/api-keys" && m === "GET") return out({ keys: [{ id: "k1", wallet: "0x", label: "notebook", prefix: "lak_spec", createdAt: T0 - 90 * HOUR, lastUsedAt: T0 - 3 * HOUR, revoked: false }] as ApiKeyRecord[] });
  if (path === "/v1/api-keys" && m === "POST") return out({ key: "lak_specimen_key_shown_once_0000000000", record: { id: "k2", wallet: "0x", label: (init.body as { label: string }).label, prefix: "lak_spec", createdAt: T0, lastUsedAt: null, revoked: false } });
  if (path === "/v1/telegram/link" && m === "POST") return out({ code: "SPECIMEN", url: "https://t.me/lensai_specimen_bot?start=SPECIMEN" });
  if (path === "/v1/feedback") return out({ recorded: true });
  if (path === "/v1/export") return out({ specimen: true, prefs: { watchlist: ["BTC", "ETH"] } });
  return out({});
}

async function previewAsk(body: { question: string; conversationId?: string }, onStage: (s: Stage) => void): Promise<AskAnswer> {
  for (const s of STAGES) {
    await wait(s === "generating" ? 900 : 420);
    onStage(s);
  }
  return {
    conversationId: body.conversationId ?? SPEC_CONVS[0].id,
    messageId: "m-new",
    intent: "token",
    assets: ["BTC"],
    asOf: T0,
    text: SPEC_TEXT,
    audit: SPEC_AUDIT,
    provider: "pool:groq",
    shared: false,
    degraded: false,
    llmCalls: 1,
    budgetExhausted: false,
  };
}
