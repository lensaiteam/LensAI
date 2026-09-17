import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DB } from "@/lib/capture/db/client";
import { checkClaims } from "@/lib/agent/claimcheck";
import { MockJsonLlm } from "@/lib/agent/llm/types";
import { checkNonAdvisory } from "@/lib/guardrails/outputFilter";
import { buildDb, NOW, BTC_FUNDING_REF } from "./_fixture";

let db: DB;
beforeEach(() => { db = buildDb(); });
afterEach(() => db.close());

const extraction = {
  claims: [
    { text: "BTC funding is at the very top of its yearly range", claimant: "a fund manager", numbers: [{ value: 100, unit: "percentile", ref: BTC_FUNDING_REF }], causal: false, edge_id: null },
    { text: "BTC funding is only at the 40th percentile", claimant: null, numbers: [{ value: 40, unit: "percentile", ref: BTC_FUNDING_REF }], causal: false, edge_id: null },
    { text: "ETF inflows hit $2bn today", claimant: null, numbers: [{ value: 2_000_000_000, unit: "usd", ref: null }], causal: false, edge_id: null },
    { text: "High funding pulls in basis-trade capital", claimant: null, numbers: [], causal: true, edge_id: "funding_to_basis" },
    { text: "Funding is high because whales are coordinating", claimant: null, numbers: [], causal: true, edge_id: "whale_cabal" },
    { text: "Buy BTC now before it runs", claimant: null, numbers: [], causal: false, edge_id: null },
    { text: "OI is at the 50th percentile", claimant: null, numbers: [{ value: 50, unit: "percentile", ref: "pctl:made/up/REF/365d" }], causal: false, edge_id: null },
  ],
};

describe("claim checker", () => {
  it("verdicts are arithmetic: supported / contradicted / unverifiable, with mechanism mapping", async () => {
    const llm = new MockJsonLlm([extraction]);
    const res = await checkClaims({ db, llm }, "thread about BTC funding… reach me at someone@example.com", { now: NOW });
    const v = res.claims.map((c) => c.verdict);
    expect(v).toEqual(["supported", "contradicted", "unverifiable", "unverifiable", "unverifiable", "unverifiable", "unverifiable"]);
    expect(res.claims[1].evidence[0]).toMatch(/disagrees with the store.*= 1 /);
    expect(res.claims[3]).toMatchObject({ mechanism: "documented", edgeId: "funding_to_basis" });
    expect(res.claims[4]).toMatchObject({ mechanism: "undocumented", edgeId: null }); // invented edge id is not honoured
    expect(res.claims[6].evidence).toHaveLength(0); // invented store ref contributes nothing
  });

  it("never echoes a trade instruction, scrubs the pasted text, and the render passes the guardrail", async () => {
    const llm = new MockJsonLlm([extraction]);
    const res = await checkClaims({ db, llm }, "BTC thread — reach me at someone@example.com", { now: NOW });
    expect(res.claims[5].advisory).toBe(true);
    expect(res.text).not.toContain("Buy BTC now");
    expect(res.text).toContain("reported, not repeated");
    expect(checkNonAdvisory(res.text).ok).toBe(true);
    expect(llm.calls[0].user).not.toContain("someone@example.com");
    expect(llm.calls[0].user).toContain(BTC_FUNDING_REF); // the model maps to real refs
  });

  it("fails closed on malformed extraction", async () => {
    await expect(checkClaims({ db, llm: new MockJsonLlm([{ claims: "nope" }]) }, "BTC", { now: NOW })).rejects.toThrow(/fail-closed/);
  });
});
