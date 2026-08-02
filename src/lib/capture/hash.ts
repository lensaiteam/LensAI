import { createHash } from "node:crypto";
import type { ObservationInput, ClaimInput } from "./types";

/** sha256 hex of a UTF-8 string. The corpus's content-address primitive. */
export function sha256(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Deterministic JSON: object keys sorted recursively so two equal values always
 * serialize identically (and thus hash identically), regardless of key order.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortValue);
  if (v && typeof v === "object") {
    const src = v as Record<string, unknown>;
    return Object.keys(src)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortValue(src[k]);
        return acc;
      }, {});
  }
  return v;
}

/**
 * Content hash of a factor observation over its canonical payload. Instrument
 * null and "" hash the same (both mean "not applicable"). Because value is in the
 * hash, a revised value for the same observed_at yields a NEW hash and appends;
 * an identical re-fetch yields the same hash and dedupes (OPEN_QUESTIONS Q3).
 */
export function hashObservation(o: ObservationInput): string {
  return sha256(
    canonicalJson({
      stream: o.stream,
      source: o.source,
      asset: o.asset,
      instrument: o.instrument ?? "",
      value: o.value ?? null,
      unit: o.unit ?? null,
      observedAt: o.observedAt,
      metadata: o.metadata ?? null,
    }),
  );
}

/** Content hash of a typed claim over its canonical payload. */
export function hashClaim(c: ClaimInput): string {
  return sha256(
    canonicalJson({
      articleId: c.articleId ?? null,
      claimant: c.claimant,
      claimantIncentive: c.claimantIncentive ?? null,
      claimedAt: c.claimedAt ?? null,
      claimText: c.claimText,
      mechanismRefs: c.mechanismRefs ?? null,
    }),
  );
}
