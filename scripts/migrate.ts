import { loadLocalEnv } from "./_bootstrap";
import { getDb } from "../src/lib/capture/db/client";
import { runMigrations } from "../src/lib/capture/db/migrate";
import { captureConfig } from "../src/lib/capture/config";

// Apply pending capture migrations to the configured SQLite corpus.
loadLocalEnv();
const db = getDb();
const res = runMigrations(db);
console.log(JSON.stringify({ msg: "migrate", db: captureConfig.dbPath(), applied: res.applied, skipped: res.skipped }));
db.close();
