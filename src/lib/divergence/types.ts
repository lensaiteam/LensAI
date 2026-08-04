import type { Vintage } from "../factors/stats";

export type DivergenceKind = "extreme_state" | "broken_relationship" | "structural_signature";
export type FlagStatus = "ok" | "indeterminate";

/** A single computed divergence flag (pure arithmetic; no advice). */
export interface DivergenceFlag {
  kind: DivergenceKind;
  /** e.g. "funding_rate/binance/SOL" | edge id | signature key. */
  subject: string;
  /** window for extreme_state; "" otherwise. */
  window_id: string;
  fired: boolean;
  magnitude: number | null;
  status: FlagStatus;
  vintage: Vintage;
  /** JSON-able trace of inputs, thresholds, refs — for narration + verification. */
  detail: Record<string, unknown>;
}

/** true_pit only if BOTH inputs are true_pit (a flag is as vintage-honest as its worst input). */
export function worstVintage(a: Vintage, b: Vintage): Vintage {
  return a === "current_vintage" || b === "current_vintage" ? "current_vintage" : "true_pit";
}
