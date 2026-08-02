import type { DB } from "./db/client";
import { createDal, type CaptureDal } from "./db/dal";
import { startRun, finishRun } from "./db/runs";
import { getBackfillAdapter, type BackfillAdapter } from "./adapters/backfill";
import { enabledFactors, type SourcesConfig, type FactorSource } from "./sources";
import { logger } from "./logger";

/**
 * Backfill runner (Phase 2, amendment 1: "backfill before normalize"). Imports
 * historical data for factor streams whose sources publish it, inserting with
 * is_backfill=1 and captured_at=now. Naturally idempotent: identical rows dedupe
 * on the observation key, so a re-run writes 0. Recorded in ingest_runs as
 * job="backfill:<id>" (slot null — backfill isn't slotted).
 */

export interface BackfillJobResult {
  job: string;
  source: string;
  status: "ok" | "partial" | "error" | "skipped";
  rowsWritten: number;
  rowsDeduped: number;
  errors: string[];
}

/** Core loop for one factor + adapter (adapter passed in so it's unit-testable). */
export async function runBackfillJob(db: DB, dal: CaptureDal, cfg: FactorSource, adapter: BackfillAdapter, now: number): Promise<BackfillJobResult> {
  const job = `backfill:${cfg.id}`;
  const runId = startRun(db, { job, source: cfg.source, slot: null, startedAt: now });
  let rowsWritten = 0;
  let rowsDeduped = 0;
  let errors: string[] = [];
  try {
    const res = await adapter(cfg, { now });
    errors = res.errors;
    for (const o of res.observations) {
      if (dal.insertObservation(o, now, true).inserted) rowsWritten++;
      else rowsDeduped++;
    }
  } catch (e) {
    errors.push((e as Error).message);
  }
  const status: BackfillJobResult["status"] = errors.length === 0 ? "ok" : rowsWritten + rowsDeduped > 0 ? "partial" : "error";
  finishRun(db, runId, { status, rowsWritten, rowsDeduped, error: errors.join(" | ") || null, finishedAt: Date.now() });
  const level = status === "error" ? "error" : status === "partial" ? "warn" : "info";
  logger[level]("backfill", { job, status, rowsWritten, rowsDeduped, errors: errors.length });
  return { job, source: cfg.source, status, rowsWritten, rowsDeduped, errors };
}

export async function backfillFactor(db: DB, dal: CaptureDal, cfg: FactorSource, now: number): Promise<BackfillJobResult> {
  const adapter = getBackfillAdapter(cfg.adapter);
  if (!adapter) {
    return { job: `backfill:${cfg.id}`, source: cfg.source, status: "skipped", rowsWritten: 0, rowsDeduped: 0, errors: [] };
  }
  return runBackfillJob(db, dal, cfg, adapter, now);
}

/** Backfill every backfillable factor (or a subset by id). Sequential — a bulk
 *  one-off pull, gentle on the public APIs. */
export async function runBackfill(db: DB, cfg: SourcesConfig, filterIds?: string[], now: number = Date.now()): Promise<BackfillJobResult[]> {
  const dal = createDal(db);
  const factors = enabledFactors(cfg).filter((f) => getBackfillAdapter(f.adapter) && (!filterIds || filterIds.includes(f.id)));
  const results: BackfillJobResult[] = [];
  for (const f of factors) results.push(await backfillFactor(db, dal, f, now));
  return results;
}
