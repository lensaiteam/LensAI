import { loadLocalEnv } from "./_bootstrap";
import { getDb } from "../src/lib/capture/db/client";
import { runMigrations } from "../src/lib/capture/db/migrate";
import { loadSeedFromFile } from "../src/lib/mechanism/loader";
import { loadGraph } from "../src/lib/mechanism/graph";
import { logger } from "../src/lib/capture/logger";

// Validate + load the mechanism-graph seed into the DB (idempotent; append-only).
loadLocalEnv();
const db = getDb();
runMigrations(db);
const loaded = loadSeedFromFile();
const outcome = loadGraph(db, loaded);
if (outcome.action === "noop_same_content") {
  logger.warn("graph load no-op: identical content already loaded under another version", outcome);
} else {
  logger.info("graph load", outcome);
}
db.close();
