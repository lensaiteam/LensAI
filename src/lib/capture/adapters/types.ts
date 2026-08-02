import type { ArticleInput, ObservationInput } from "../types";
import type { ArticleSource, FactorSource } from "../sources";

/** Passed to every adapter for a single scheduled fetch. */
export interface FetchContext {
  /** Floored schedule-slot boundary (ms). Used as observed_at for POLLED streams. */
  slot: number;
  /** Reference capture time (ms). */
  now: number;
}

/**
 * Adapters return successes AND errors together, never null. This is the
 * non-silent fail-soft contract (OPEN_QUESTIONS Q5): partial failures still yield
 * the rows that succeeded, and the scheduler records every error in ingest_runs
 * so a quietly-failing feed shows up in `capture:tail` instead of leaving an
 * invisible hole in the corpus.
 */
export interface FactorResult {
  observations: ObservationInput[];
  errors: string[];
}
export interface ArticleResult {
  articles: ArticleInput[];
  errors: string[];
}

export type FactorAdapter = (cfg: FactorSource, ctx: FetchContext) => Promise<FactorResult>;
export type ArticleAdapter = (cfg: ArticleSource, ctx: FetchContext) => Promise<ArticleResult>;
