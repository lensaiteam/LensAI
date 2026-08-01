import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, type DB } from "@/lib/capture/db/client";
import { runMigrations } from "@/lib/capture/db/migrate";

// INVARIANT 1 — immutable capture. The corpus tables must reject in-place edits;
// corrections/revisions are new rows only. Operational tables stay mutable.

let db: DB;

beforeEach(() => {
  db = openDb(":memory:");
  runMigrations(db);
});

afterEach(() => {
  db.close();
});

describe("INVARIANT 1 — immutable capture", () => {
  it("applies the migration and records it", () => {
    const rows = db.prepare("SELECT version FROM schema_migrations").all() as { version: string }[];
    expect(rows.map((r) => r.version)).toContain("0001_capture_init");
    // Re-running is a no-op (idempotent).
    const res = runMigrations(db);
    expect(res.applied).toHaveLength(0);
    expect(res.skipped).toContain("0001_capture_init");
  });

  it("rejects UPDATE and DELETE on articles", () => {
    db.prepare(
      `INSERT INTO articles (source, url, content_hash, extracted_text, captured_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run("coindesk", "https://example/1", "hash1", "hello world", 1000);

    expect(() =>
      db.prepare("UPDATE articles SET title = ? WHERE content_hash = ?").run("edited", "hash1"),
    ).toThrow(/append-only/);

    expect(() =>
      db.prepare("DELETE FROM articles WHERE content_hash = ?").run("hash1"),
    ).toThrow(/append-only/);

    const { c } = db.prepare("SELECT count(*) AS c FROM articles").get() as { c: number };
    expect(c).toBe(1); // survived both attempts
  });

  it("rejects UPDATE and DELETE on factor_observations", () => {
    db.prepare(
      `INSERT INTO factor_observations (stream, source, asset, observed_at, content_hash, captured_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("funding_rate", "binance", "BTC", 1000, "obshash", 1000);

    expect(() => db.prepare("UPDATE factor_observations SET value = 1").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM factor_observations").run()).toThrow(/append-only/);
  });

  it("rejects UPDATE and DELETE on claims", () => {
    db.prepare(
      `INSERT INTO claims (claimant, claim_text, content_hash) VALUES (?, ?, ?)`,
    ).run("alice", "X amplified Y", "claimhash");

    expect(() => db.prepare("UPDATE claims SET claim_text = 'z'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM claims").run()).toThrow(/append-only/);
  });

  it("allows UPDATE on operational ingest_runs (not corpus)", () => {
    const info = db
      .prepare("INSERT INTO ingest_runs (job, started_at, status) VALUES (?, ?, ?)")
      .run("rss:coindesk", 1000, "running");

    expect(() =>
      db
        .prepare("UPDATE ingest_runs SET status = 'ok', finished_at = ? WHERE id = ?")
        .run(2000, info.lastInsertRowid),
    ).not.toThrow();

    const row = db.prepare("SELECT status FROM ingest_runs WHERE id = ?").get(info.lastInsertRowid) as {
      status: string;
    };
    expect(row.status).toBe("ok");
  });
});
