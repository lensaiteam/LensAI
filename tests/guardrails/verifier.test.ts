import { describe, it, expect } from "vitest";
import { UnimplementedClaimVerifier, type ClaimVerifier } from "@/lib/guardrails/verifier";

// INVARIANT 4 — the stub must conform to the interface and NEVER report a claim as
// resolved (fail-closed), so it cannot silently bless numbers before Phase 6.

describe("ClaimVerifier stub", () => {
  const verifier: ClaimVerifier = new UnimplementedClaimVerifier();

  it("returns unresolved with no store refs and a reason", async () => {
    const res = await verifier.verify({ value: 0.92, unit: "percentile" }, Date.now());
    expect(res.resolved).toBe(false);
    expect(res.storeRefs).toEqual([]);
    expect(res.reason).toMatch(/Phase 6|stub/i);
  });

  it("never resolves regardless of input", async () => {
    for (const value of [0, 4.5, 68000, -1]) {
      const res = await verifier.verify({ value }, 1_000_000);
      expect(res.resolved).toBe(false);
    }
  });
});
