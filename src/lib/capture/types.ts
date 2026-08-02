/**
 * Shared capture-layer record types (no runtime deps, no imports — safe to import
 * from anywhere in the subsystem). Source-config types are inferred from the zod
 * schema in `sources.ts`; these are the DAL/adapter record shapes.
 *
 * All timestamps are epoch MILLISECONDS. `capturedAt` is set by the DAL at insert
 * (true server clock); the source's own time is always separate (`publishedAt` /
 * `observedAt`).
 */

/** An article as an adapter produces it, before hashing/normalization in the DAL. */
export interface ArticleInput {
  source: string;
  url: string;
  guid?: string | null;
  title?: string | null;
  author?: string | null;
  publishedAt?: number | null;
  rawHtml?: string | null;
  /** Best-effort text; the DAL normalizes it, hashes the result, and stores it. */
  extractedText: string;
  lang?: string | null;
}

/** A single factor reading as an adapter produces it. */
export interface ObservationInput {
  stream: string;
  source: string;
  asset: string;
  /** Perp/spot symbol, e.g. "BTCUSDT"; "" (never null) when not applicable. */
  instrument?: string | null;
  value?: number | null;
  unit?: string | null;
  /** Source time, or the floored schedule-slot boundary for polled streams. */
  observedAt: number;
  metadata?: Record<string, unknown> | null;
}

/** A typed mechanism claim (schema only in Phase 1; extraction is later). */
export interface ClaimInput {
  articleId?: number | null;
  claimant: string;
  claimantIncentive?: string | null;
  claimedAt?: number | null;
  claimText: string;
  mechanismRefs?: string[] | null;
}

/** Result of an append attempt: `inserted:false` means the row was a dedupe. */
export interface InsertResult {
  inserted: boolean;
  id: number | null;
}
