import { loadLocalEnv } from "./_bootstrap";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { getDb } from "../src/lib/capture/db/client";
import { captureConfig } from "../src/lib/capture/config";
import { logger } from "../src/lib/capture/logger";

/**
 * Back up the corpus — it is the moat and a single file is a single point of
 * failure. Preferred production path is continuous litestream replication; this
 * script is the fallback consistent snapshot (better-sqlite3 .backup, WAL-safe),
 * which you then copy OFF the machine (README §Backup).
 */
async function main(): Promise<void> {
  loadLocalEnv();

  const replica = captureConfig.litestreamReplicaUrl();
  const dir = captureConfig.backupDir();

  if (!dir) {
    if (replica) {
      logger.info("litestream configured — run it as a separate process; this snapshot script is the fallback", {
        replica,
      });
    }
    logger.error("no CAPTURE_BACKUP_DIR set — set it (or run litestream) to back up the corpus");
    process.exit(1);
  }

  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = join(dir, `capture-${stamp}.db`);

  const db = getDb();
  await db.backup(dest);
  db.close();
  logger.info("backup complete", { dest, note: "copy this OFF the machine (object storage / another host)" });
}

main().catch((e) => {
  logger.error("backup fatal", { error: (e as Error).message });
  process.exit(1);
});
