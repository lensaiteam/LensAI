import { describe, it, expect } from "vitest";
import { sha256, canonicalJson, hashObservation, hashClaim } from "@/lib/capture/hash";
import type { ObservationInput } from "@/lib/capture/types";

describe("hash", () => {
  it("sha256 is deterministic and hex-encoded", () => {
    expect(sha256("hello")).toBe(sha256("hello"));
    expect(sha256("hello")).toMatch(/^[0-9a-f]{64}$/);
    expect(sha256("a")).not.toBe(sha256("b"));
  });

  it("canonicalJson is key-order independent but value-sensitive", () => {
    expect(canonicalJson({ a: 1, b: 2 })).toBe(canonicalJson({ b: 2, a: 1 }));
    expect(canonicalJson({ a: { x: 1, y: 2 } })).toBe(canonicalJson({ a: { y: 2, x: 1 } }));
    expect(canonicalJson({ a: 1, b: 2 })).not.toBe(canonicalJson({ a: 1, b: 3 }));
  });

  it("observation hash: identical payload dedupes, changed value appends", () => {
    const base: ObservationInput = {
      stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT",
      value: 0.01, unit: "rate_8h", observedAt: 1000, metadata: null,
    };
    expect(hashObservation(base)).toBe(hashObservation({ ...base }));
    // Revision (same observed_at, different value) -> different hash -> new row.
    expect(hashObservation(base)).not.toBe(hashObservation({ ...base, value: 0.02 }));
  });

  it("observation hash treats instrument null and '' as equal", () => {
    const a: ObservationInput = { stream: "s", source: "x", asset: "BTC", observedAt: 1, instrument: "" };
    const b: ObservationInput = { stream: "s", source: "x", asset: "BTC", observedAt: 1, instrument: null };
    expect(hashObservation(a)).toBe(hashObservation(b));
  });

  it("claim hash is stable and content-sensitive", () => {
    const c = { claimant: "alice", claimText: "X amplified Y", claimedAt: 5, mechanismRefs: ["m1"] };
    expect(hashClaim(c)).toBe(hashClaim({ ...c }));
    expect(hashClaim(c)).not.toBe(hashClaim({ ...c, claimText: "X caused Y" }));
  });
});
