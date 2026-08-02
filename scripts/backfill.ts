import { loadLocalEnv } from "./_bootstrap";
import { getDb } from "../src/lib/capture/db/client";
import { runMigrations } from "../src/lib/capture/db/migrate";
import { runBackfill } from "../src/lib/capture/backfill";
import { loadSources } from "../src/lib/capture/sources";
import { logger } from "../src/lib/capture/logger";

/**
 * One-off historical backfill (Phase 2). Imports real history for backfillable
 * factor streams (Binance funding/OI, CoinGecko prices/volume, FRED full series).
 * Idempotent — safe to re-run; identical rows dedupe.
 *   backfill [sourceId ...]   (no args = all backfillable factors)
 */
async function main(): Promise<void> {
  loadLocalEnv();
  const db = getDb();
  runMigrations(db);
  const cfg = loadSources();
  const ids = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const results = await runBackfill(db, cfg, ids.length ? ids : undefined);
  const written = results.reduce((s, r) => s + r.rowsWritten, 0);
  const deduped = results.reduce((s, r) => s + r.rowsDeduped, 0);
  logger.info("backfill complete", {
    jobs: results.length,
    rowsWritten: written,
    rowsDeduped: deduped,
    errored: results.filter((r) => r.status === "error").map((r) => r.job),
  });
  db.close();
}

main().catch((e) => {
  logger.error("backfill fatal", { error: (e as Error).message });
  process.exit(1);
});
