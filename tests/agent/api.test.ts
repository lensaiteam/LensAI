import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { SignJWT } from "jose";
import type { DB } from "@/lib/capture/db/client";
import { createAgentApi, type ApiRequest } from "@/lib/agent/api";
import { signAgentToken, verifyAgentToken, newApiKey, hashApiKey } from "@/lib/agent/auth";
import { MemoryUserStore } from "@/lib/agent/store/memory";
import { MemoryNotifier } from "@/lib/agent/notify";
import { deriveCycle } from "@/lib/agent/service";
import { MockJsonLlm, type JsonRequest } from "@/lib/agent/llm/types";
import { listBriefs } from "@/lib/narrate/briefs";
import { buildDb, NOW, ANCHOR_B, BTC_FUNDING_REF } from "./_fixture";

const SECRET = "test-secret-test-secret-test-secret!";
const WALLET = "0x52908400098527886e0f7030069857d2e4169ee7";
const OTHER = "0x8617e340b3d01fa5f11f306f4090fd50e238070d";

const goodBrief = {
  headline: "BTC — funding stretched",
  claims: [{ text: "BTC perp funding sits at the top of its 365-day range.", basis: "measured", refs: [BTC_FUNDING_REF], numbers: [{ value: 1.0, ref: BTC_FUNDING_REF }] }],
};
const RULE = { all: [{ type: "percentile", stream: "funding_rate", asset: "ETH", window: "365d", op: "lte", value: 0.05 }], cooldown_hours: 24 };

let db: DB;
let store: MemoryUserStore;
let llm: MockJsonLlm;
let api: ReturnType<typeof createAgentApi>;
let token: string;

function setup(answers: unknown[] | ((r: JsonRequest) => unknown), limits = { dailyLlm: 5, perMinute: 100, maxWatches: 2 }) {
  llm = new MockJsonLlm(answers);
  api = createAgentApi({ db, llm, store, secret: SECRET, limits, telegramBotName: "lensai_bot", now: () => NOW });
}
const call = (method: string, path: string, body?: unknown, auth: string | null = token, extra: Partial<ApiRequest> = {}) =>
  api({ method, path, headers: { authorization: auth ? `Bearer ${auth}` : undefined }, body: body === undefined ? undefined : JSON.stringify(body), ...extra });

beforeEach(async () => {
  db = buildDb();
  store = new MemoryUserStore(() => NOW);
  token = await signAgentToken(WALLET, SECRET);
  setup(() => goodBrief);
});
afterEach(() => db.close());

describe("auth", () => {
  it("rejects missing, garbage, wrong-secret and wrong-audience tokens", async () => {
    expect((await call("GET", "/v1/prefs", undefined, null)).status).toBe(401);
    expect((await call("GET", "/v1/prefs", undefined, "garbage")).status).toBe(401);
    expect((await call("GET", "/v1/prefs", undefined, await signAgentToken(WALLET, "another-secret-another-secret-123456"))).status).toBe(401);
    // A long-lived web SESSION token (no agent audience) must not be accepted here.
    const sessionLike = await new SignJWT({ wallet_address: WALLET }).setProtectedHeader({ alg: "HS256" }).setIssuer("lensai").setSubject(WALLET).setExpirationTime("1h").sign(new TextEncoder().encode(SECRET));
    expect(await verifyAgentToken(sessionLike, SECRET)).toBeNull();
    expect((await call("GET", "/v1/prefs", undefined, sessionLike)).status).toBe(401);
  });

  it("api keys reach the ask/read surface and /rpc, but never account management", async () => {
    const made = await call("POST", "/v1/api-keys", { label: "my bot" });
    expect(made.status).toBe(201);
    const key = (made.body as { key: string }).key;
    expect(key.startsWith("lak_")).toBe(true);
    expect(JSON.stringify(await store.exportAll(WALLET))).not.toContain(key); // only a hash is kept

    expect((await call("POST", "/v1/ask", { question: "brief on BTC" }, key)).status).toBe(200);
    const rpc = await call("POST", "/rpc", { jsonrpc: "2.0", id: 1, method: "tools/list" }, key);
    expect((rpc.body as { result: { tools: unknown[] } }).result.tools.length).toBeGreaterThan(3);
    expect((await call("GET", "/v1/export", undefined, key)).status).toBe(403);
    expect((await call("DELETE", "/v1/account", undefined, key)).status).toBe(403);
    expect((await call("POST", "/rpc", { method: "tools/list" }, "lak_not_a_real_key")).status).toBe(401);

    const id = ((await call("GET", "/v1/api-keys")).body as { keys: { id: string }[] }).keys[0].id;
    await call("DELETE", `/v1/api-keys/${id}`);
    expect((await call("POST", "/v1/ask", { question: "brief on BTC" }, key)).status).toBe(401);
    expect(await store.findApiKeyByHash(hashApiKey(key))).toBeNull();
  });

  it("rate-limits per wallet per minute", async () => {
    setup(() => goodBrief, { dailyLlm: 5, perMinute: 2, maxWatches: 2 });
    await call("GET", "/v1/usage");
    await call("GET", "/v1/usage");
    expect((await call("GET", "/v1/usage")).status).toBe(429);
  });
});

describe("POST /v1/ask", () => {
  it("answers, stores the (scrubbed) turn, threads the conversation and marks last-seen", async () => {
    const r = await call("POST", "/v1/ask", { question: "brief on BTC — I'm someone@example.com" });
    expect(r.status).toBe(200);
    const body = r.body as { conversationId: string; text: string; asOf: number; llmCalls: number };
    expect(body.text).toContain("top of its 365-day range");
    const msgs = (await store.getMessages(WALLET, body.conversationId))!;
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(msgs[0].content).not.toContain("someone@example.com");
    expect((await store.getPrefs(WALLET)).lastSeenAsOf).toBe(ANCHOR_B);
    expect(await store.getUsage(WALLET, "llm", "1971-02-04")).toBe(body.llmCalls);

    // Follow-up with no asset inherits the conversation's subject.
    const f = await call("POST", "/v1/ask", { question: "what changed?", conversationId: body.conversationId });
    expect((f.body as { assets: string[] }).assets).toEqual(["BTC"]);
    expect((await call("POST", "/v1/ask", { question: "hi", conversationId: "00000000-0000-4000-8000-000000000000" })).status).toBe(404);
  });

  it("another wallet cannot read or continue the conversation", async () => {
    const body = (await call("POST", "/v1/ask", { question: "brief on BTC" })).body as { conversationId: string };
    const other = await signAgentToken(OTHER, SECRET);
    expect((await call("GET", `/v1/conversations/${body.conversationId}`, undefined, other)).status).toBe(404);
    expect((await call("POST", "/v1/ask", { question: "and?", conversationId: body.conversationId }, other)).status).toBe(404);
  });

  it("past the daily budget the model is NOT consulted — the desk still answers from shared/measured state", async () => {
    setup(() => goodBrief, { dailyLlm: 1, perMinute: 100, maxWatches: 2 });
    await call("POST", "/v1/ask", { question: "brief on ETH" }); // spends the budget
    const calls = llm.calls.length;
    const r = (await call("POST", "/v1/ask", { question: "is BTC funding confirmed by open interest?" })).body as { degraded: boolean; budgetExhausted: boolean; text: string };
    expect(llm.calls.length).toBe(calls);
    expect(r).toMatchObject({ degraded: true, budgetExhausted: true });
    expect(r.text).toContain("Measured state");
    expect((await call("POST", "/v1/claim-check", { text: "BTC funding is at the top of its range" })).status).toBe(429);
  });

  it("streams stages then the answer over SSE", async () => {
    const r = await call("POST", "/v1/ask", { question: "brief on BTC" }, token, { headers: { authorization: `Bearer ${token}`, accept: "text/event-stream" } });
    const events: [string, unknown][] = [];
    await r.stream!((e, d) => events.push([e, d]));
    expect(events.map((e) => e[0])).toEqual(["stage", "stage", "stage", "stage", "answer"]);
    expect((events.at(-1)![1] as { text: string }).text).toContain("365-day range");
  });

  it("no user identifier ever reaches the model across the whole surface", async () => {
    await store.setPrefs(WALLET, { email: "me@private.io", telegramChatId: "987654321" });
    await call("POST", "/v1/ask", { question: `brief on BTC for ${WALLET} / me@private.io` });
    await call("POST", "/v1/ask", { question: "is leverage building in BTC relative to history, in detail?" });
    await call("POST", "/v1/watches/compile", { text: "ETH funding washed out, mail me@private.io" });
    await call("POST", "/v1/claim-check", { text: `BTC funding is extreme says ${WALLET} on telegram 987654321` }).catch(() => null);
    expect(llm.calls.length).toBeGreaterThan(2);
    for (const c of llm.calls) {
      const prompt = `${c.system}\n${c.user}`.toLowerCase();
      expect(prompt).not.toContain(WALLET);
      expect(prompt).not.toContain("me@private.io");
      expect(c.forbid).toEqual(expect.arrayContaining([WALLET, "me@private.io", "987654321"]));
    }
  });
});

describe("watches over HTTP", () => {
  it("compile → confirm → create, with channel + vocabulary + limit checks", async () => {
    setup([{ ok: true, rule: RULE }]);
    const compiled = (await call("POST", "/v1/watches/compile", { text: "tell me when ETH funding is washed out" })).body as { ok: boolean; rule: unknown; description: string };
    expect(compiled.ok).toBe(true);
    expect(compiled.description).toMatch(/^Alert when funding_rate ETH is at or below P5/);

    expect((await call("POST", "/v1/watches", { text: "t e s t", rule: compiled.rule, channel: "telegram" })).status).toBe(409); // not linked
    const link = (await call("POST", "/v1/telegram/link")).body as { code: string; url: string };
    expect(link.url).toBe(`https://t.me/lensai_bot?start=${link.code}`);
    await store.setPrefs(WALLET, { telegramChatId: "42" });

    expect((await call("POST", "/v1/watches", { text: "watch eth", rule: compiled.rule, channel: "telegram" })).status).toBe(201);
    const bogus = { all: [{ type: "percentile", stream: "etf_flows", asset: "BTC", window: "365d", op: "gte", value: 0.9 }], cooldown_hours: 24 };
    expect((await call("POST", "/v1/watches", { text: "watch etf", rule: bogus, channel: "telegram" })).status).toBe(422);
    await call("POST", "/v1/watches", { text: "watch eth 2", rule: compiled.rule, channel: "telegram" });
    expect((await call("POST", "/v1/watches", { text: "watch eth 3", rule: compiled.rule, channel: "telegram" })).status).toBe(409); // limit 2

    const list = (await call("GET", "/v1/watches")).body as { watches: { id: string }[] };
    expect((await call("PATCH", `/v1/watches/${list.watches[0].id}`, { status: "paused" })).status).toBe(200);
    expect((await call("DELETE", `/v1/watches/${list.watches[0].id}`)).status).toBe(200);
    expect((await call("GET", "/v1/prefs")).body).not.toHaveProperty("prefs.telegramLinkCode");
  });
});

describe("data rights", () => {
  it("export returns everything; DELETE /account erases it", async () => {
    await call("PUT", "/v1/prefs", { watchlist: ["btc", "BTC", "eth"], email: "me@private.io" });
    await call("POST", "/v1/ask", { question: "brief on BTC" });
    const dump = (await call("GET", "/v1/export")).body as { prefs: { watchlist: string[] }; conversations: unknown[] };
    expect(dump.prefs.watchlist).toEqual(["BTC", "ETH"]);
    expect(dump.conversations).toHaveLength(1);

    expect((await call("DELETE", "/v1/account")).status).toBe(200);
    const after = (await call("GET", "/v1/export")).body as { prefs: { email: string | null }; conversations: unknown[] };
    expect(after.conversations).toEqual([]);
    expect(after.prefs.email).toBeNull();
    // The shared brief is user-agnostic and survives — it holds nothing about the user.
    expect(listBriefs(db, { surface: "token", asset: "BTC" })).toHaveLength(1);
    expect(JSON.stringify(listBriefs(db))).not.toContain(WALLET);
  });

  it("rejects malformed bodies", async () => {
    expect((await call("POST", "/v1/ask", { question: "" })).status).toBe(400);
    expect((await call("PUT", "/v1/prefs", { email: "not-an-email" })).status).toBe(400);
    expect((await call("PUT", "/v1/prefs", { watchlist: ["DROP TABLE"] })).status).toBe(400);
    expect((await call("GET", "/v1/nope")).status).toBe(404);
  });
});

describe("deriveCycle", () => {
  it("computes a new anchor, files ONE shared market brief, and runs the watches", async () => {
    await store.setPrefs(WALLET, { telegramChatId: "42" });
    await store.createWatch(WALLET, { text: "t", rule: RULE as never, description: "d", channel: "telegram" });
    const notifier = new MemoryNotifier();
    const marketBrief = { claims: [{ text: "BTC funding is at a historical extreme.", basis: "measured", refs: [], numbers: [] }] };
    const r = await deriveCycle({ db, llm: new MockJsonLlm([marketBrief]), store, notifier, pregenerateMarket: true }, NOW + 3_600_000);
    expect(r).toMatchObject({ brief: "generated", watchesFired: 1 });
    expect(listBriefs(db, { surface: "market" })).toHaveLength(1);
    expect(notifier.sent).toHaveLength(1);
    expect((await api({ method: "GET", path: "/health", headers: {} })).body).toMatchObject({ ok: true });
  });
});
