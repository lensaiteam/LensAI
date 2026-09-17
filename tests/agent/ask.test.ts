import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DB } from "@/lib/capture/db/client";
import { askAgent } from "@/lib/agent/ask";
import { computeChanges } from "@/lib/agent/changes";
import { planHeuristic, findAssets } from "@/lib/agent/plan";
import { MockJsonLlm, PoolExhaustedError } from "@/lib/agent/llm/types";
import { listBriefs } from "@/lib/narrate/briefs";
import { auditClaims } from "@/lib/narrate/orchestrator";
import { checkNonAdvisory } from "@/lib/guardrails/outputFilter";
import { buildDb, ANCHOR_A, ANCHOR_B, NOW, BTC_FUNDING_REF } from "./_fixture";

let db: DB;
beforeEach(() => { db = buildDb(); });
afterEach(() => db.close());

const KNOWN = ["BTC", "ETH"];

const goodBrief = {
  headline: "BTC — funding stretched",
  claims: [
    { text: "BTC perp funding sits at the top of its 365-day range.", basis: "measured", refs: [BTC_FUNDING_REF], numbers: [{ value: 1.0, unit: "percentile", ref: BTC_FUNDING_REF }] },
    { text: "Elevated funding draws basis-trade capital via the documented channel.", basis: "mechanical", refs: ["funding_to_basis"], numbers: [] },
  ],
};

describe("planner heuristics (zero model calls)", () => {
  it("routes the common shapes confidently", () => {
    expect(planHeuristic("market state", KNOWN)).toMatchObject({ confident: true, plan: { intent: "market", focus: null } });
    expect(planHeuristic("brief on ETH", KNOWN)).toMatchObject({ confident: true, plan: { intent: "token", assets: ["ETH"], focus: null } });
    expect(planHeuristic("how is bitcoin doing?", KNOWN)).toMatchObject({ confident: true, plan: { intent: "token", assets: ["BTC"] } });
    expect(planHeuristic("what changed in the last 3 days?", KNOWN)).toMatchObject({ confident: true, plan: { intent: "changes", since_hours: 72 } });
    expect(planHeuristic("should I buy SOL now?", KNOWN).plan.intent).toBe("advice");
    expect(planHeuristic("what's your track record?", KNOWN).plan.intent).toBe("track_record");
  });
  it("is NOT confident on a specific angle, and never treats plain words as tickers", () => {
    expect(planHeuristic("is BTC funding confirmed by open interest?", KNOWN).confident).toBe(false);
    expect(findAssets("AND THE ETH", KNOWN)).toEqual(["ETH"]);
  });
});

describe("askAgent", () => {
  it("serves a generic read via narration, persists it, then reuses the SHARED brief for the next user", async () => {
    const llm = new MockJsonLlm([goodBrief]);
    const first = await askAgent({ db, llm }, { question: "brief on BTC", now: NOW });
    expect(first).toMatchObject({ intent: "token", shared: false, degraded: false, llmCalls: 1, asOf: ANCHOR_B });
    expect(first.text).toContain("top of its 365-day range");
    expect(listBriefs(db, { surface: "token", asset: "BTC" })).toHaveLength(1);

    const second = await askAgent({ db, llm }, { question: "BTC?", now: NOW });
    expect(second).toMatchObject({ shared: true, llmCalls: 0 });
    expect(second.text).toBe(first.text);
    expect(llm.calls).toHaveLength(1); // generated once for everyone
  });

  it("answers a specific question, drops unverifiable claims, and does NOT write it to the append-only record", async () => {
    const answer = {
      headline: "BTC funding vs OI",
      claims: [
        goodBrief.claims[0],
        { text: "Open interest is at the 3rd percentile.", basis: "measured", refs: [], numbers: [{ value: 0.03 }] },
        { text: "Funding is near the 94th percentile.", basis: "measured", refs: [], numbers: [] }, // number only in prose
      ],
    };
    const llm = new MockJsonLlm([{ intent: "token", assets: ["BTC"], focus: "funding vs open interest", since_hours: null }, answer]);
    const res = await askAgent({ db, llm }, { question: "is BTC funding confirmed by open interest?", now: NOW });
    expect(res.llmCalls).toBe(2);
    expect(res.text).toContain("top of its 365-day range");
    expect(res.text).not.toMatch(/3rd percentile|94th/);
    expect(res.audit.filter((a) => !a.kept).map((a) => a.reason).sort()).toEqual(["undeclared-number", "unverified-number"]);
    expect(listBriefs(db)).toHaveLength(0); // question-derived output never enters `briefs`
  });

  it("retries on a DIFFERENT provider when nothing survives verification", async () => {
    const bad = { claims: [{ text: "Funding is at the 12th percentile.", basis: "measured", refs: [], numbers: [{ value: 0.12 }] }] };
    let n = 0;
    const llm = new MockJsonLlm((req) => {
      if (req.tier === "small") return { intent: "token", assets: ["BTC"], focus: "funding", since_hours: null };
      return n++ === 0 ? bad : goodBrief;
    });
    const res = await askAgent({ db, llm }, { question: "where exactly is BTC funding versus history?", now: NOW });
    expect(res.degraded).toBe(false);
    const strong = llm.calls.filter((c) => c.tier === "strong");
    expect(strong).toHaveLength(2);
    expect(strong[1].exclude).toEqual(["mock"]);
  });

  it("degrades to the measured state when the pool is exhausted — never an error, never a guess", async () => {
    const llm = new MockJsonLlm(() => new PoolExhaustedError([]));
    const res = await askAgent({ db, llm }, { question: "brief on BTC", now: NOW });
    expect(res).toMatchObject({ degraded: true, llmCalls: 1 });
    expect(res.text).toContain("Measured state");
    expect(res.text).toContain(BTC_FUNDING_REF);
  });

  it("answers an advice question with structure, not an action", async () => {
    const res = await askAgent({ db, llm: new MockJsonLlm([goodBrief]) }, { question: "should I buy BTC now?", now: NOW });
    expect(res.intent).toBe("advice");
    expect(res.text).toMatch(/never says what to do/);
    expect(checkNonAdvisory(res.text).ok).toBe(true);
  });

  it("'what changed' and the track record are pure arithmetic (zero model calls)", async () => {
    const llm = new MockJsonLlm([]);
    const ch = await askAgent({ db, llm }, { question: "what changed since my last visit?", lastSeenAsOf: ANCHOR_A, now: NOW });
    expect(ch.text).toContain("funding_regime[ETH]: elevated → suppressed");
    const tr = await askAgent({ db, llm }, { question: "what's your track record?", now: NOW });
    expect(tr.text).toMatch(/calibration record is empty/);
    expect(llm.calls).toHaveLength(0);
  });

  it("scrubs identifiers out of the question before any prompt is built", async () => {
    const llm = new MockJsonLlm([{ intent: "market", assets: [], focus: "leverage", since_hours: null }, goodBrief]);
    await askAgent({ db, llm }, { question: "I'm 0x52908400098527886E0F7030069857D2E4169EE7 — is leverage building across the market?", now: NOW });
    for (const c of llm.calls) expect(`${c.system}${c.user}`).not.toContain("0x5290");
  });
});

describe("INV-4 on prose numbers", () => {
  const facts = [{ ref: BTC_FUNDING_REF, value: 0.97 }];
  const claim = (text: string) => ({ text, basis: "conjecture" as const, refs: [], numbers: [] });
  it("keeps an undeclared prose number that RESOLVES to the store, and cites the row", async () => {
    const { kept, audit } = await auditClaims([claim("A 0.97 funding percentile alongside muted basis is unusual.")], { facts, edgeIds: new Set() });
    expect(kept).toHaveLength(1);
    expect(audit[0].refs).toContain(BTC_FUNDING_REF);
  });
  it("drops one that does not resolve, and ignores duration labels", async () => {
    const { audit } = await auditClaims([claim("Funding is near the 55th percentile."), claim("Funding has been elevated across the 365-day window.")], { facts, edgeIds: new Set() });
    expect(audit.map((a) => a.kept)).toEqual([false, true]);
    expect(audit[0].reason).toBe("undeclared-number");
  });
});

describe("computeChanges", () => {
  it("diffs flags (incl. direction flips), regimes and percentile movers between two anchors", () => {
    const ch = computeChanges(db, { since: ANCHOR_A, asOf: NOW });
    expect(ch.from?.as_of).toBe(ANCHOR_A);
    expect(ch.to?.as_of).toBe(ANCHOR_B);
    expect(ch.regimeChanges).toContainEqual({ regime_key: "funding_regime", asset: "ETH", from: "elevated", to: "suppressed" });
    expect(ch.flagsOpened).toContainEqual({ kind: "extreme_state", subject: "funding_rate/binance/ETH", window_id: "365d", direction: "low" });
    expect(ch.flagsCleared.some((f) => f.subject === "funding_rate/binance/ETH" && f.direction === "high")).toBe(true);
    expect(ch.movers[0]).toMatchObject({ asset: "ETH", stream: "funding_rate" });
  });
  it("scopes to requested assets and reports 'no new state' for a same-anchor window", () => {
    expect(computeChanges(db, { since: ANCHOR_A, asOf: NOW, assets: ["BTC"] }).regimeChanges).toHaveLength(0);
    expect(computeChanges(db, { since: NOW, asOf: NOW }).text).toMatch(/No new computed state/);
  });
});
