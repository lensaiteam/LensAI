import { loadLocalEnv } from "./_bootstrap";
import { getDb } from "../src/lib/capture/db/client";
import { runMigrations } from "../src/lib/capture/db/migrate";
import { runOnce, runForever } from "../src/lib/capture/scheduler";
import { loadSources } from "../src/lib/capture/sources";
import { captureConfig } from "../src/lib/capture/config";
import { logger } from "../src/lib/capture/logger";

/**
 * Capture daemon entrypoint.
 *   capture --once   run every job once for its current slot, then exit (DoD).
 *   capture          run forever on CAPTURE_TICK_MS, until SIGINT/SIGTERM.
 * Idempotent + restart-safe: state lives in ingest_runs, so re-running is safe.
 */
async function main(): Promise<void> {
  loadLocalEnv();
  const once = process.argv.includes("--once");
  const db = getDb();
  runMigrations(db);
  const cfg = loadSources();

  if (once) {
    const results = await runOnce(db, cfg);
    const written = results.reduce((s, r) => s + r.rowsWritten, 0);
    const deduped = results.reduce((s, r) => s + r.rowsDeduped, 0);
    const errored = results.filter((r) => r.status === "error").map((r) => r.job);
    logger.info("capture --once complete", {
      jobs: results.length,
      rowsWritten: written,
      rowsDeduped: deduped,
      errored,
    });
    db.close();
    return;
  }

  const { stop, done } = runForever(db, cfg, captureConfig.tickMs());
  const shutdown = () => {
    logger.info("shutdown signal received");
    stop();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await done;
  db.close();
}

main().catch((e) => {
  logger.error("capture fatal", { error: (e as Error).message });
  process.exit(1);
});
