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
 * accidentally strips numbers rather than blessing them. Implemented in Phase 6.
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
