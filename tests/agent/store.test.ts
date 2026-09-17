import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { MemoryUserStore } from "@/lib/agent/store/memory";
import { ruleSchema, describeRule } from "@/lib/agent/watch/rule";

const A = "0xaaa";
const B = "0xbbb";
const RULE = ruleSchema.parse({ all: [{ type: "signature", key: "fragile" }] });
const DAY = 86_400_000;

async function seed(store: MemoryUserStore, wallet: string) {
  await store.touchUser(wallet);
  await store.setPrefs(wallet, { watchlist: ["BTC"], email: "u@x.io", lastSeenAsOf: 123 });
  const c = await store.createConversation(wallet, "first");
  const m = await store.appendMessage(wallet, c.id, { role: "user", content: "brief on BTC" });
  const w = await store.createWatch(wallet, { text: "fragile", rule: RULE, description: describeRule(RULE), channel: "email" });
  await store.recordTrigger({ watchId: w.id, firedAt: 1, asOf: 1, message: "m", delivered: true });
  await store.createApiKey(wallet, { label: "bot", hash: `hash-${wallet}`, prefix: "lak_1234" });
  await store.saveClaimCheck(wallet, { input: "x", result: {} });
  await store.addFeedback(wallet, { messageId: m!.id, rating: 1 });
  await store.bumpUsage(wallet, "ask", "2026-09-17");
  return { c, w };
}

describe("user store — tenancy", () => {
  it("one wallet can never read or mutate another's rows", async () => {
    const store = new MemoryUserStore();
    const { c, w } = await seed(store, A);
    expect(await store.getMessages(B, c.id)).toBeNull();
    expect(await store.appendMessage(B, c.id, { role: "user", content: "x" })).toBeNull();
    expect(await store.deleteConversation(B, c.id)).toBe(false);
    expect(await store.updateWatch(B, w.id, { status: "paused" })).toBeNull();
    expect(await store.deleteWatch(B, w.id)).toBe(false);
    expect(await store.listTriggers(B, w.id)).toEqual([]);
    expect(await store.listConversations(B)).toEqual([]);
  });

  it("api keys are looked up by hash, never returned with it, and revocation sticks", async () => {
    const store = new MemoryUserStore();
    await seed(store, A);
    const found = await store.findApiKeyByHash(`hash-${A}`);
    expect(found).toMatchObject({ wallet: A, prefix: "lak_1234" });
    expect(JSON.stringify(await store.listApiKeys(A))).not.toContain("hash-");
    await store.revokeApiKey(A, found!.id);
    expect(await store.findApiKeyByHash(`hash-${A}`)).toBeNull();
  });
});

describe("user store — export, erasure, retention", () => {
  it("exports everything held about a wallet", async () => {
    const store = new MemoryUserStore();
    await seed(store, A);
    const dump = (await store.exportAll(A)) as { conversations: { messages: unknown[] }[]; watches: { triggers: unknown[] }[]; prefs: { email: string } };
    expect(dump.conversations[0].messages).toHaveLength(1);
    expect(dump.watches[0].triggers).toHaveLength(1);
    expect(dump.prefs.email).toBe("u@x.io");
  });

  it("deleteAll erases one wallet completely and leaves others intact", async () => {
    const store = new MemoryUserStore();
    await seed(store, A);
    await seed(store, B);
    await store.deleteAll(A);
    const gone = (await store.exportAll(A)) as Record<string, unknown[] | Record<string, unknown>>;
    expect(gone.conversations).toEqual([]);
    expect(gone.watches).toEqual([]);
    expect(gone.apiKeys).toEqual([]);
    expect(gone.claimChecks).toEqual([]);
    expect(gone.feedback).toEqual([]);
    expect(gone.prefs).toMatchObject({ email: null, watchlist: [], lastSeenAsOf: null });
    expect(await store.getUsage(A, "ask", "2026-09-17")).toBe(0);
    expect(await store.findApiKeyByHash(`hash-${A}`)).toBeNull();
    expect(await store.listConversations(B)).toHaveLength(1);
    expect(await store.listActiveWatches()).toHaveLength(1);
  });

  it("purges conversations idle past the retention window", async () => {
    let t = 0;
    const store = new MemoryUserStore(() => t);
    const old = await store.createConversation(A, "old");
    t = 100 * DAY;
    const fresh = await store.createConversation(A, "fresh");
    expect(await store.purgeExpired(90, t)).toBe(1);
    expect((await store.listConversations(A)).map((c) => c.id)).toEqual([fresh.id]);
    expect(await store.getMessages(A, old.id)).toBeNull();
  });
});

describe("supabase schema (0002_agent.sql)", () => {
  const sql = readFileSync("db/migrations/0002_agent.sql", "utf8");
  const tables = [...sql.matchAll(/create table if not exists (\w+)/g)].map((m) => m[1]);

  it("every agent table cascades from users or a parent that does (erasure by account deletion)", () => {
    expect(tables.length).toBeGreaterThanOrEqual(9);
    for (const t of tables) {
      const body = sql.slice(sql.indexOf(`create table if not exists ${t}`)).split(");")[0];
      expect(body, t).toMatch(/on delete cascade/);
    }
  });
  it("RLS is enabled on every agent table", () => {
    for (const t of tables) expect(sql, t).toMatch(new RegExp(`alter table ${t}\\s+enable row level security`));
  });
  it("stores no balances, no IPs, and only a HASH of api keys", () => {
    expect(sql).not.toMatch(/\b(balance|ip_address|ip_hash|private_key|seed)\b/i);
    expect(sql).toMatch(/key_hash\s+text not null unique/);
  });
});
