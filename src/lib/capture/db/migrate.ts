import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "./client";

export type Dialect = "sqlite" | "postgres";

// Resolve db/capture/migrations relative to this file (src/lib/capture/db/ -> repo root).
const MIGRATIONS_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../db/capture/migrations",
);

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

/**
 * Apply pending SQL migrations in filename order, each in its own transaction,
 * tracked in `schema_migrations`. Idempotent: already-applied versions are
 * skipped, so it is safe to run on every daemon start.
 *
 * Phase 1 uses the "sqlite" dialect (this runner uses a better-sqlite3 handle).
 * The "postgres" folder is the twin the future lift applies via a pg-based runner;
 * pointing this SQLite runner at it would be a mistake, so we guard against it.
 */
export function runMigrations(db: DB, dialect: Dialect = "sqlite"): MigrationResult {
  if (dialect !== "sqlite") {
    throw new Error(`runMigrations: this runner is SQLite-only; "${dialect}" is applied by the lift-phase pg runner.`);
  }

  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  );`);

  const dir = join(MIGRATIONS_ROOT, dialect);
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  const has = db.prepare("SELECT 1 FROM schema_migrations WHERE version = ?");
  const mark = db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)");

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const version = file.replace(/\.sql$/, "");
    if (has.get(version)) {
      skipped.push(version);
      continue;
    }
    const sql = readFileSync(join(dir, file), "utf8");
    const tx = db.transaction(() => {
      db.exec(sql);
      mark.run(version, Date.now());
    });
    tx();
    applied.push(version);
  }

  return { applied, skipped };
}
