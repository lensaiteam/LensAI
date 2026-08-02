import type { DB } from "./db/client";
import { createDal, type CaptureDal } from "./db/dal";
import { successfulRun, startRun, finishRun } from "./db/runs";
import { getFactorAdapter, getArticleAdapter, type FactorAdapter, type ArticleAdapter } from "./adapters";
import { loadSources, enabledArticles, enabledFactors, type SourcesConfig, type ArticleSource, type FactorSource } from "./sources";
import { logger } from "./logger";

// Articles have no per-source interval in config; poll them on this cadence.
const ARTICLE_INTERVAL_SEC = 600;
const DEFAULT_CONCURRENCY = 6;

export type Job =
  | { id: string; kind: "factor"; source: string; intervalSec: number; cfg: FactorSource; run: FactorAdapter }
  | { id: string; kind: "article"; source: string; intervalSec: number; cfg: ArticleSource; run: ArticleAdapter };

export interface JobResult {
  job: string;
  slot: number;
  status: "ok" | "partial" | "error" | "skipped";
  rowsWritten: number;
  rowsDeduped: number;
  errors: string[];
}

/** Floored schedule-slot boundary (ms) — the observed_at for polled streams and
 *  the idempotency key: re-running within a slot is a no-op. */
export function slotFor(now: number, intervalSec: number): number {
  const step = intervalSec * 1000;
  return Math.floor(now / step) * step;
}

/** Resolve the config into runnable jobs; unknown factor adapters are skipped loudly. */
export function buildJobs(cfg: SourcesConfig): Job[] {
  const jobs: Job[] = [];
  for (const a of enabledArticles(cfg)) {
    const run = getArticleAdapter(a.type);
    if (!run) {
      logger.warn("no adapter for article type", { source: a.id, type: a.type });
      continue;
    }
    jobs.push({ id: `rss:${a.id}`, kind: "article", source: a.id, intervalSec: ARTICLE_INTERVAL_SEC, cfg: a, run });
  }
  for (const f of enabledFactors(cfg)) {
    const run = getFactorAdapter(f.adapter);
    if (!run) {
      logger.warn("no adapter for factor", { source: f.id, adapter: f.adapter });
      continue;
    }
    jobs.push({ id: `factor:${f.id}`, kind: "factor", source: f.source, intervalSec: f.interval_sec, cfg: f, run });
  }
  return jobs;
}

/** Run one job for its current slot. Skips if that slot already succeeded. */
export async function runJob(db: DB, dal: CaptureDal, job: Job, now: number): Promise<JobResult> {
  const slot = slotFor(now, job.intervalSec);
  if (successfulRun(db, job.id, slot)) {
    return { job: job.id, slot, status: "skipped", rowsWritten: 0, rowsDeduped: 0, errors: [] };
  }

  const runId = startRun(db, { job: job.id, source: job.source, slot, startedAt: now });
  let rowsWritten = 0;
  let rowsDeduped = 0;
  let errors: string[] = [];

  try {
    if (job.kind === "factor") {
      const res = await job.run(job.cfg, { slot, now });
      errors = res.errors;
      for (const o of res.observations) {
        if (dal.insertObservation(o, now).inserted) rowsWritten++;
        else rowsDeduped++;
      }
    } else {
      const res = await job.run(job.cfg, { slot, now });
      errors = res.errors;
      for (const a of res.articles) {
        if (dal.insertArticle(a, now).inserted) rowsWritten++;
        else rowsDeduped++;
      }
    }
  } catch (e) {
    errors.push((e as Error).message);
  }

  const status: JobResult["status"] =
    errors.length === 0 ? "ok" : rowsWritten + rowsDeduped > 0 ? "partial" : "error";
  finishRun(db, runId, { status, rowsWritten, rowsDeduped, error: errors.join(" | ") || null, finishedAt: Date.now() });

  const level = status === "error" ? "error" : status === "partial" ? "warn" : "info";
  logger[level]("ingest", { job: job.id, slot, status, rowsWritten, rowsDeduped, errors: errors.length });
  return { job: job.id, slot, status, rowsWritten, rowsDeduped, errors };
}

/** Bounded-concurrency map (network-friendly). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Run every job once for its current slot. Idempotent + restart-safe: already-done
 *  slots skip (state read from ingest_runs in the DB). */
export async function runJobs(db: DB, jobs: Job[], now: number = Date.now(), concurrency = DEFAULT_CONCURRENCY): Promise<JobResult[]> {
  const dal = createDal(db);
  return mapLimit(jobs, concurrency, (job) => runJob(db, dal, job, now));
}

/** Build jobs from config and run one tick. */
export async function runOnce(db: DB, cfg: SourcesConfig = loadSources(), now: number = Date.now()): Promise<JobResult[]> {
  return runJobs(db, buildJobs(cfg), now);
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Run ticks forever until `stop()` is called (e.g. on SIGINT). */
export function runForever(db: DB, cfg: SourcesConfig, tickMs: number): { stop: () => void; done: Promise<void> } {
  let stopped = false;
  const jobs = buildJobs(cfg);
  const done = (async () => {
    logger.info("capture daemon started", { jobs: jobs.length, tickMs });
    while (!stopped) {
      try {
        await runJobs(db, jobs);
      } catch (e) {
        logger.error("tick failed", { error: (e as Error).message });
      }
      if (stopped) break;
      await sleep(tickMs);
    }
    logger.info("capture daemon stopped");
  })();
  return { stop: () => { stopped = true; }, done };
}
