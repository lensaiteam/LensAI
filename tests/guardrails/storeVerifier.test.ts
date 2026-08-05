import { describe, it, expect } from "vitest";
import { StoreClaimVerifier, UnimplementedClaimVerifier, type StoreFact, type ClaimVerifier } from "@/lib/guardrails/verifier";

const facts: StoreFact[] = [
  { ref: "pctl:funding_rate/binance/SOL/365d", value: 1.0, label: "SOL funding 365d" },
  { ref: "pctl:funding_rate/binance/BTC/365d", value: 0.942, label: "BTC funding 365d" },
  { ref: "obs:stablecoin_float/TOTAL", value: 165_000_000_000, label: "stablecoin float" },
];

describe("StoreClaimVerifier (INV-4)", () => {
  const v = new StoreClaimVerifier(facts);

  it("resolves a claim whose value matches a store fact", async () => {
    const r = await v.verify({ value: 0.942 });
    expect(r.resolved).toBe(true);
    expect(r.storeRefs).toContain("pctl:funding_rate/binance/BTC/365d");
  });

  it("resolves a percentile stated as 94 against a stored fraction 0.942 (scaling)", async () => {
    const r = await v.verify({ value: 94.2, unit: "percentile" });
    expect(r.resolved).toBe(true);
  });

  it("drops a claim that matches no store value", async () => {
    const r = await v.verify({ value: 0.5 });
    expect(r.resolved).toBe(false);
    expect(r.reason).toMatch(/no store value/);
  });

  it("with a cited ref, requires the ref to exist and carry the value", async () => {
    expect((await v.verify({ value: 1.0, ref: "pctl:funding_rate/binance/SOL/365d" })).resolved).toBe(true);
    expect((await v.verify({ value: 0.3, ref: "pctl:funding_rate/binance/SOL/365d" })).resolved).toBe(false); // wrong value
    expect((await v.verify({ value: 1.0, ref: "pctl:nope" })).resolved).toBe(false); // unknown ref
  });

  it("honors a large-magnitude fact within relative tolerance", async () => {
    expect((await v.verify({ value: 165_100_000_000 })).resolved).toBe(true); // within 1%
    expect((await v.verify({ value: 200_000_000_000 })).resolved).toBe(false);
  });

  it("the Phase 1 stub still fails closed", async () => {
    const stub: ClaimVerifier = new UnimplementedClaimVerifier();
    expect((await stub.verify({ value: 0.942 }, 0)).resolved).toBe(false);
  });
});
