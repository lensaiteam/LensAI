/**
 * INVARIANT 4 — numeric traceability. Any generated numeric claim must resolve to
 * a row in the store before release. The real verifier arrives with narration
 * (Phase 6); this defines the interface now and ships a fail-CLOSED stub so a
 * claim can never silently pass as "verified" in the meantime.
 */

export interface NumericClaim {
  /** The asserted number as written (e.g. 0.92, 4.5, 68000). */
  value: number;
  /** Optional unit/scale hint ("percentile", "percent", "usd"). */
  unit?: string;
  /** Free-text surrounding the claim, for locating the supporting row. */
  context?: string;
}

export interface VerificationResult {
  /** True ONLY when the claim was matched to a concrete store row. */
  resolved: boolean;
  /** Identifiers of the store rows that support the claim (e.g. "factor_observations:123"). */
  storeRefs: string[];
  /** Why it did/didn't resolve. */
  reason?: string;
}

export interface ClaimVerifier {
  verify(claim: NumericClaim, asOf: number | Date): Promise<VerificationResult>;
}

/**
 * Phase 1 stub. Fail-closed: every claim comes back unresolved, so wiring this in
 * accidentally strips numbers rather than blessing them. Superseded in Phase 6 by
 * StoreClaimVerifier.
 */
export class UnimplementedClaimVerifier implements ClaimVerifier {
  async verify(): Promise<VerificationResult> {
    return {
      resolved: false,
      storeRefs: [],
      reason: "ClaimVerifier is a Phase 1 stub (implemented in Phase 6 narration).",
    };
  }
}

/** A ground-truth number gathered from the store, with a citable ref. */
export interface StoreFact {
  ref: string;
  value: number;
  label?: string;
}

export interface VerifierTolerance {
  /** Relative tolerance (fraction of the store value). Default 1%. */
  rel?: number;
  /** Absolute tolerance floor. Default 1e-9. */
  abs?: number;
}

function close(a: number, b: number, rel: number, abs: number): boolean {
  return Math.abs(a - b) <= Math.max(abs, rel * Math.abs(b));
}

/**
 * Phase 6 ClaimVerifier (INV-4). Resolves a numeric claim against the store facts
 * gathered for the same as_of. Fail-closed: a claim that matches no store value
 * (or whose asserted `ref` doesn't carry that value) is UNRESOLVED, and the
 * narration pipeline drops it. A percentile stated as "94th" (94) also matches a
 * stored fraction 0.94 — we test the value and its /100 and *100 scalings.
 */
export class StoreClaimVerifier implements ClaimVerifier {
  private byRef: Map<string, StoreFact>;
  constructor(private facts: StoreFact[], private tol: VerifierTolerance = {}) {
    this.byRef = new Map(facts.map((f) => [f.ref, f]));
  }

  async verify(claim: NumericClaim & { ref?: string }): Promise<VerificationResult> {
    const rel = this.tol.rel ?? 0.01;
    const abs = this.tol.abs ?? 1e-9;
    const candidates = [claim.value, claim.value / 100, claim.value * 100];

    // If the claim cites a specific ref, it must exist AND carry the value.
    if (claim.ref) {
      const fact = this.byRef.get(claim.ref);
      if (!fact) return { resolved: false, storeRefs: [], reason: `unknown store ref "${claim.ref}"` };
      const ok = candidates.some((c) => close(c, fact.value, rel, abs));
      return ok
        ? { resolved: true, storeRefs: [fact.ref] }
        : { resolved: false, storeRefs: [], reason: `value ${claim.value} != store ${fact.value} @ ${fact.ref}` };
    }

    // Otherwise, tolerant match against every gathered fact.
    const matches = this.facts.filter((f) => candidates.some((c) => close(c, f.value, rel, abs)));
    if (matches.length) return { resolved: true, storeRefs: matches.map((m) => m.ref) };
    return { resolved: false, storeRefs: [], reason: `no store value matches ${claim.value}` };
  }
}
