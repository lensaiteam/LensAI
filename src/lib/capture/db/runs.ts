import type { DB } from "./client";

/**
 * Operational bookkeeping over the MUTABLE `ingest_runs` table (not the corpus,
 * so this bypasses the point-in-time DAL). Drives idempotent/restart-safe
 * scheduling and makes gaps visible: every attempt is a row, every failure keeps
 * its error text, and `capture:tail` reads last-success-per-source from here.
 */

export type RunStatus = "running" | "ok" | "partial" | "error" | "skipped";

export interface RunRow {
  id: number;
  job: string;
  source: string | null;
  slot: number | null;
  started_at: number;
  finished_at: number | null;
  status: RunStatus;
  rows_written: number;
  rows_deduped: number;
  error: string | null;
}

/** A prior SUCCESSFUL (ok|partial) run for this job+slot means "already done". */
export function successfulRun(db: DB, job: string, slot: number): RunRow | undefined {
  return db
    .prepare("SELECT * FROM ingest_runs WHERE job = ? AND slot = ? AND status IN ('ok','partial') LIMIT 1")
    .get(job, slot) as RunRow | undefined;
}

export function startRun(db: DB, r: { job: string; source: string | null; slot: number | null; startedAt: number }): number {
  const info = db
    .prepare("INSERT INTO ingest_runs (job, source, slot, started_at, status) VALUES (?, ?, ?, ?, 'running')")
    .run(r.job, r.source, r.slot, r.startedAt);
  return Number(info.lastInsertRowid);
}

export function finishRun(
  db: DB,
  id: number,
  r: { status: RunStatus; rowsWritten: number; rowsDeduped: number; error: string | null; finishedAt: number },
): void {
  db.prepare(
    "UPDATE ingest_runs SET status = ?, rows_written = ?, rows_deduped = ?, error = ?, finished_at = ? WHERE id = ?",
  ).run(r.status, r.rowsWritten, r.rowsDeduped, r.error, r.finishedAt, id);
}

/** Most recent run per source, any status (for the tail view). */
export function lastRunPerSource(db: DB): RunRow[] {
  return db
    .prepare(
      `SELECT r.* FROM ingest_runs r
       JOIN (SELECT source, MAX(started_at) AS mx FROM ingest_runs GROUP BY source) m
         ON r.source = m.source AND r.started_at = m.mx
       ORDER BY r.source`,
    )
    .all() as RunRow[];
}

/** Most recent SUCCESSFUL run per source (so a stale success reveals a gap). */
export function lastSuccessPerSource(db: DB): RunRow[] {
  return db
    .prepare(
      `SELECT r.* FROM ingest_runs r
       JOIN (SELECT source, MAX(started_at) AS mx FROM ingest_runs WHERE status IN ('ok','partial') GROUP BY source) m
         ON r.source = m.source AND r.started_at = m.mx
       ORDER BY r.source`,
    )
    .all() as RunRow[];
}

export function recentRuns(db: DB, limit = 20): RunRow[] {
  return db.prepare("SELECT * FROM ingest_runs ORDER BY started_at DESC, id DESC LIMIT ?").all(limit) as RunRow[];
}
