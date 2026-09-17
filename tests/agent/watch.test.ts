import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DB } from "@/lib/capture/db/client";
import { resolveComputedAnchor } from "@/lib/tools/handlers";
import { ruleSchema, describeRule, loadVocabulary, validateAgainstVocabulary, type WatchRule } from "@/lib/agent/watch/rule";
import { evaluateRule } from "@/lib/agent/watch/evaluate";
import { compileWatch } from "@/lib/agent/watch/compile";
import { runWatches } from "@/lib/agent/watch/runner";
import { MemoryUserStore } from "@/lib/agent/store/memory";
import { MemoryNotifier, HttpNotifier, pollTelegramLinks } from "@/lib/agent/notify";
import { MockJsonLlm } from "@/lib/agent/llm/types";
import { checkNonAdvisory } from "@/lib/guardrails/outputFilter";
import { DAY } from "@/lib/factors/windows";
import { buildDb, computeAt, ANCHOR_A, ANCHOR_B, NOW } from "./_fixture";

let db: DB;
beforeEach(() => { db = buildDb(); });
afterEach(() => db.close());

const W = "0xabc";
// "ETH funding washed out while BTC funding is stretched" — true at B, false at A.
const RULE: WatchRule = ruleSchema.parse({
  all: [
    { type: "percentile", stream: "funding_rate", asset: "ETH", op: "lte", value: 0.05 },
    { type: "percentile", stream: "funding_rate", asset: "BTC", op: "gte", value: 0.95 },
  ],
});

describe("rule DSL", () => {
  it("applies defaults and echoes deterministically", () => {
    expect(RULE.cooldown_hours).toBe(24);
    expect(RULE.all[0]).toMatchObject({ window: "365d" });
    expect(describeRule(RULE)).toBe("Alert when funding_rate ETH is at or below P5 of its own 365d history AND funding_rate BTC is at or above P95 of its own 365d history (at most once per 24h).");
  });
  it("rejects an empty rule, >5 conditions and out-of-range percentiles", () => {
    expect(ruleSchema.safeParse({ all: [] }).success).toBe(false);
    expect(ruleSchema.safeParse({ all: Array(6).fill(RULE.all[0]) }).success).toBe(false);
    expect(ruleSchema.safeParse({ all: [{ ...RULE.all[0], value: 94 }] }).success).toBe(false);
  });
  it("validates against the store's closed vocabulary", () => {
    const vocab = loadVocabulary(db, NOW);
    expect(validateAgainstVocabulary(RULE, vocab)).toEqual([]);
    const bogus = ruleSchema.parse({ all: [{ type: "percentile", stream: "etf_flows", asset: "BTC", op: "gte", value: 0.9 }, { type: "percentile", stream: "open_interest", asset: "ETH", op: "gte", value: 0.9 }] });
    expect(validateAgainstVocabulary(bogus, vocab)).toHaveLength(2);
  });
});

describe("evaluateRule (pure arithmetic, fail-closed)", () => {
  it("fires at B, not at A, with citable evidence", () => {
    const a = evaluateRule(db, RULE, resolveComputedAnchor(db, ANCHOR_A)!);
    const b = evaluateRule(db, RULE, resolveComputedAnchor(db, NOW)!);
    expect(a.fired).toBe(false);
    expect(b.fired).toBe(true);
    expect(b.conditions[0].evidence).toBe("funding_rate/binance ETH 365d = P0");
  });
  it("regime / divergence / signature conditions", () => {
    const anchor = resolveComputedAnchor(db, NOW)!;
    const rule = ruleSchema.parse({ all: [{ type: "regime", regime_key: "funding_regime", asset: "ETH", equals: "suppressed" }, { type: "divergence", kind: "extreme_state", subject_includes: "eth" }, { type: "signature", key: "leverage_led", asset: "BTC" }] });
    expect(evaluateRule(db, rule, anchor).fired).toBe(true);
    expect(evaluateRule(db, ruleSchema.parse({ all: [{ type: "signature", key: "spot_led" }] }), anchor).fired).toBe(false);
  });
  it("missing data never satisfies a condition", () => {
    const rule = ruleSchema.parse({ all: [{ type: "percentile", stream: "funding_rate", asset: "SOL", op: "lte", value: 1 }] });
    const r = evaluateRule(db, rule, resolveComputedAnchor(db, NOW)!);
    expect(r.fired).toBe(false);
    expect(r.conditions[0].evidence).toMatch(/no 365d percentile/);
  });
});

describe("compileWatch", () => {
  it("compiles, validates and echoes", async () => {
    const llm = new MockJsonLlm([{ ok: true, rule: { all: RULE.all, cooldown_hours: 12 } }]);
    const r = await compileWatch(llm, "tell me when ETH funding is washed out while BTC funding is extreme", loadVocabulary(db, NOW));
    expect(r).toMatchObject({ ok: true, rule: { cooldown_hours: 12 } });
    expect(llm.calls[0].tier).toBe("small");
  });
  it("refuses what the store cannot express, model refusals, and malformed output", async () => {
    const vocab = loadVocabulary(db, NOW);
    const invented = await compileWatch(new MockJsonLlm([{ ok: true, rule: { all: [{ type: "percentile", stream: "etf_flows", asset: "BTC", op: "gte", value: 0.9 }] } }]), "etf flows high", vocab);
    expect(invented).toMatchObject({ ok: false });
    expect(await compileWatch(new MockJsonLlm([{ ok: false, reason: "Price levels are not something the desk watches." }]), "BTC hits 100k", vocab)).toEqual({ ok: false, reason: "Price levels are not something the desk watches." });
    expect((await compileWatch(new MockJsonLlm([{ nonsense: true }]), "x", vocab)).ok).toBe(false);
  });
});

describe("runWatches", () => {
  it("edge-triggers once, records the trigger, and respects evaluated-anchor + cooldown", async () => {
    const store = new MemoryUserStore();
    const notifier = new MemoryNotifier();
    await store.setPrefs(W, { telegramChatId: "42" });
    const w = await store.createWatch(W, { text: "t", rule: RULE, description: describeRule(RULE), channel: "telegram" });

    expect(await runWatches(db, store, notifier, { now: ANCHOR_A + 1 })).toMatchObject({ evaluated: 1, fired: 0 });
    const run = await runWatches(db, store, notifier, { now: NOW });
    expect(run).toMatchObject({ anchor: ANCHOR_B, evaluated: 1, fired: 1, delivered: 1 });
    expect(notifier.sent[0].body).toContain("funding_rate/binance ETH 365d = P0");
    expect(checkNonAdvisory(notifier.sent[0].body).ok).toBe(true);
    expect(await store.listTriggers(W, w.id)).toHaveLength(1);

    // Same anchor again → not re-evaluated.
    expect(await runWatches(db, store, notifier, { now: NOW + 5 })).toMatchObject({ evaluated: 0, fired: 0 });

    // State persists at the next anchor → no re-fire (edge-triggered).
    const ANCHOR_C = ANCHOR_B + 3_600_000;
    computeAt(db, ANCHOR_C);
    expect(await runWatches(db, store, notifier, { now: ANCHOR_C + 1 })).toMatchObject({ evaluated: 1, fired: 0 });
    expect(notifier.sent).toHaveLength(1);
  });

  it("a flapping state cannot re-fire inside the cooldown; paused watches are skipped", async () => {
    const store = new MemoryUserStore();
    const notifier = new MemoryNotifier(false); // delivery fails → still recorded
    const w = await store.createWatch(W, { text: "t", rule: RULE, description: describeRule(RULE), channel: "email" });
    await runWatches(db, store, notifier, { now: NOW });
    expect((await store.listTriggers(W, w.id))[0].delivered).toBe(false);

    await store.recordEvaluation(w.id, { state: false, asOf: ANCHOR_B }); // simulate a flap back to false
    const ANCHOR_C = ANCHOR_B + 3_600_000;
    computeAt(db, ANCHOR_C);
    expect(await runWatches(db, store, notifier, { now: ANCHOR_C + 1 })).toMatchObject({ evaluated: 1, fired: 0 }); // inside 24h cooldown

    await store.updateWatch(W, w.id, { status: "paused" });
    computeAt(db, ANCHOR_B + 2 * DAY);
    expect(await runWatches(db, store, notifier, { now: ANCHOR_B + 2 * DAY + 1 })).toMatchObject({ evaluated: 0 });
  });
});

describe("notifier", () => {
  it("sends via Telegram / Resend and is unavailable without credentials", async () => {
    const calls: string[] = [];
    const fetchFn = async (url: string) => { calls.push(url); return { ok: true, status: 200, text: async () => "{}" }; };
    const n = new HttpNotifier({ telegramBotToken: "T", resendApiKey: "R", alertFromEmail: "desk@lensai.test" }, fetchFn);
    const prefs = { watchlist: [], timezone: null, email: "u@x.io", telegramChatId: "42", telegramLinkCode: null, lastSeenAsOf: null };
    expect(await n.send("telegram", prefs, { title: "t", body: "b" })).toBe(true);
    expect(await n.send("email", prefs, { title: "t", body: "b" })).toBe(true);
    expect(calls).toEqual(["https://api.telegram.org/botT/sendMessage", "https://api.resend.com/emails"]);
    expect(await new HttpNotifier({}, fetchFn).send("telegram", prefs, { title: "t", body: "b" })).toBe(false);
    expect(await n.send("email", { ...prefs, email: null }, { title: "t", body: "b" })).toBe(false);
  });

  it("binds a Telegram chat from a /start <code> message", async () => {
    const store = new MemoryUserStore();
    await store.setPrefs(W, { telegramLinkCode: "link_code_123" });
    const fetchFn = async (url: string) => ({
      ok: true,
      status: 200,
      text: async () => (url.endsWith("/getUpdates") ? JSON.stringify({ result: [{ update_id: 7, message: { text: "/start link_code_123", chat: { id: 555 } } }, { update_id: 8, message: { text: "hello", chat: { id: 9 } } }] }) : "{}"),
    });
    const next = await pollTelegramLinks("T", 0, async (code, chatId) => {
      const wallet = await store.findWalletByTelegramCode(code);
      if (!wallet) return false;
      await store.setPrefs(wallet, { telegramChatId: chatId, telegramLinkCode: null });
      return true;
    }, fetchFn);
    expect(next).toBe(9);
    expect(await store.getPrefs(W)).toMatchObject({ telegramChatId: "555", telegramLinkCode: null });
  });
});
