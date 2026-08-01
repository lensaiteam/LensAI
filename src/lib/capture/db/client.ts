import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { captureConfig } from "../config";

export type DB = Database.Database;

/**
 * Open a capture SQLite database with the pragmas the corpus needs.
 *
 * WAL mode: the daemon is the single writer; later phases (factor store, tools)
 * read concurrently — WAL lets readers proceed without blocking the writer.
 * busy_timeout absorbs brief lock contention instead of throwing SQLITE_BUSY.
 *
 * Pass ":memory:" for tests (WAL is a no-op there, which is fine).
 */
export function openDb(path: string): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL"); // WAL-appropriate: durable across app crashes, faster
  return db;
}

let singleton: DB | null = null;

/** Process-wide handle to the configured corpus file. */
export function getDb(): DB {
  if (!singleton) singleton = openDb(captureConfig.dbPath());
  return singleton;
}

export function closeDb(): void {
  if (singleton) {
    singleton.close();
    singleton = null;
  }
}
