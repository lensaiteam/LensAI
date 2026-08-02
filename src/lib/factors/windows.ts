/**
 * Fixed, NAMED percentile windows (Phase 2 sharpening #4). Each factor stream is
 * scored over a small named set rather than one blessed window; the divergence
 * engine (Phase 4) chooses among them. window_id + params are stamped on every
 * derived row so a percentile is reproducible and self-describing.
 */
export const DAY = 86_400_000;

export interface WindowDef {
  id: string;
  /** Lookback in ms; null = full history (all observations up to the slot). */
  lookbackMs: number | null;
}

export const DEFAULT_WINDOWS: WindowDef[] = [
  { id: "90d", lookbackMs: 90 * DAY },
  { id: "365d", lookbackMs: 365 * DAY },
  { id: "full", lookbackMs: null },
];

/**
 * Minimum observations in a window before a percentile may be emitted as a number
 * (Phase 2 amendment #4). Below this, the window yields `insufficient_history` —
 * thin data is a flagged risk, never a quiet statistic. Applied PER window.
 */
export const MIN_OBS = 30;

/** Bump when the percentile method changes; stamped on every derived row. */
export const NORMALIZER_CODE_VERSION = "pctl-v1";
