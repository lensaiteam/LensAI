import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, type DB } from "@/lib/capture/db/client";
import { runMigrations } from "@/lib/capture/db/migrate";
import { createDal, type CaptureDal } from "@/lib/capture/db/dal";
import type { ObservationInput } from "@/lib/capture/types";

let db: DB;
let dal: CaptureDal;
beforeEach(() => {
  db = openDb(":memory:");
  runMigrations(db);
  dal = createDal(db);
});
afterEach(() => db.close());

function obs(over: Partial<ObservationInput>): ObservationInput {
  return { stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: 0.01, observedAt: 100, ...over };
}

describe("DAL — observation read filters", () => {
  beforeEach(() => {
    dal.insertObservation(obs({ asset: "BTC", stream: "funding_rate", instrument: "BTCUSDT", value: 0.01, observedAt: 100 }), 1000);
    dal.insertObservation(obs({ asset: "ETH", stream: "funding_rate", instrument: "ETHUSDT", value: 0.02, observedAt: 100 }), 1000);
    dal.insertObservation(obs({ asset: "BTC", stream: "open_interest", instrument: "BTCUSDT", value: 5000, observedAt: 100 }), 2000);
    dal.insertObservation(obs({ asset: "BTC", stream: "spot_price", source: "coingecko", instrument: "", value: 68000, observedAt: 100 }), 3000);
  });

  it("filters by stream / asset / source / instrument", () => {
    expect(dal.getObservations({ asOf: 9999, stream: "funding_rate" })).toHaveLength(2);
    expect(dal.getObservations({ asOf: 9999, asset: "BTC" })).toHaveLength(3);
    expect(dal.getObservations({ asOf: 9999, source: "coingecko" })).toHaveLength(1);
    expect(dal.getObservations({ asOf: 9999, asset: "BTC", instrument: "BTCUSDT" })).toHaveLength(2);
  });

  it("honors since (captured_at lower bound) and limit", () => {
    expect(dal.getObservations({ asOf: 9999, since: 2000 })).toHaveLength(2); // captured at 2000 and 3000
    expect(dal.getObservations({ asOf: 9999, limit: 1 })).toHaveLength(1);
  });

  it("parses metadata JSON back to an object", () => {
    dal.insertObservation(obs({ asset: "SOL", metadata: { markPrice: 150, nested: { a: 1 } } }), 4000);
    const row = dal.getObservations({ asOf: 9999, asset: "SOL" })[0];
    expect(row.metadata).toEqual({ markPrice: 150, nested: { a: 1 } });
  });
});

describe("DAL — claims", () => {
  it("inserts, dedupes on content_hash, and reads point-in-time", () => {
    const a = dal.insertArticle({ source: "coindesk", url: "https://x/1", extractedText: "body" }, 500);
    const c1 = dal.insertClaim({ articleId: a.id, claimant: "alice", claimText: "X amplified Y", mechanismRefs: ["m1", "m2"] }, 1000);
    const dup = dal.insertClaim({ articleId: a.id, claimant: "alice", claimText: "X amplified Y", mechanismRefs: ["m1", "m2"] }, 1500);
    expect(c1.inserted).toBe(true);
    expect(dup.inserted).toBe(false);

    expect(dal.getClaims({ asOf: 999 })).toHaveLength(0); // before it was captured
    const rows = dal.getClaims({ asOf: 2000, claimant: "alice" });
    expect(rows).toHaveLength(1);
    expect(rows[0].mechanism_refs).toEqual(["m1", "m2"]);
    expect(rows[0].article_id).toBe(a.id);
  });

  it("enforces the article_id foreign key", () => {
    expect(() => dal.insertClaim({ articleId: 999999, claimant: "bob", claimText: "orphan" }, 1000)).toThrow(/FOREIGN KEY/i);
  });
});

describe("DB hardening (file-backed)", () => {
  let dir: string;
  let path: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "lensai-cap-"));
    path = join(dir, "capture.db");
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("opens in WAL mode with foreign keys on", () => {
    const fdb = openDb(path);
    expect(String(fdb.pragma("journal_mode", { simple: true })).toLowerCase()).toBe("wal");
    expect(fdb.pragma("foreign_keys", { simple: true })).toBe(1);
    fdb.close();
  });

  it("persists data + migration ledger across reopen (restart-safe)", () => {
    const first = openDb(path);
    runMigrations(first);
    createDal(first).insertArticle({ source: "coindesk", url: "https://x/1", extractedText: "hello" }, 1000);
    first.close();

    const second = openDb(path);
    const res = runMigrations(second); // idempotent on reopen
    expect(res.applied).toHaveLength(0);
    expect(createDal(second).getArticles({ asOf: 9999 })).toHaveLength(1);
    second.close();
  });
});
