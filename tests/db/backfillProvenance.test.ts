import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, type DB } from "@/lib/capture/db/client";
import { runMigrations } from "@/lib/capture/db/migrate";
import { createDal, type CaptureDal } from "@/lib/capture/db/dal";
import type { ObservationInput } from "@/lib/capture/types";

// Phase 2 amendment 1 — backfill provenance. Backfilled rows carry is_backfill=1
// and their TRUE captured_at (= now), so the point-in-time DAL keeps history honest.

let db: DB;
let dal: CaptureDal;
beforeEach(() => {
  db = openDb(":memory:");
  runMigrations(db);
  dal = createDal(db);
});
afterEach(() => db.close());

const hist = (over: Partial<ObservationInput>): ObservationInput => ({
  stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: 0.01, observedAt: 100, ...over,
});

describe("migration 0002 applies", () => {
  it("adds is_backfill and records the migration", () => {
    const cols = (db.prepare("PRAGMA table_info(factor_observations)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toContain("is_backfill");
    const versions = (db.prepare("SELECT version FROM schema_migrations").all() as { version: string }[]).map((r) => r.version);
    expect(versions).toContain("0002_backfill_provenance");
  });
});

describe("backfill provenance", () => {
  it("forward rows default is_backfill=0; backfill rows are flagged", () => {
    dal.insertObservation(hist({ observedAt: 100, value: 0.01 }), 5000); // forward
    dal.insertObservation(hist({ observedAt: 50, value: 0.02 }), 5000, true); // backfilled history

    const rows = dal.getObservations({ asOf: 9999, asset: "BTC" });
    const byObserved = new Map(rows.map((r) => [r.observed_at, r.is_backfill]));
    expect(byObserved.get(100)).toBe(0);
    expect(byObserved.get(50)).toBe(1);
  });

  it("backfilled row keeps observed_at in the past but captured_at = now, so an earlier as_of cannot see it", () => {
    // We learn a value for observed_at=100 only at captured_at=5000 (import time).
    dal.insertObservation(hist({ observedAt: 100, value: 0.03 }), 5000, true);

    // Anchored before we imported it -> invisible (no lookahead from importing history).
    expect(dal.getObservations({ asOf: 4000, asset: "BTC" })).toHaveLength(0);
    // Anchored at/after import time -> visible, with the historical observed_at.
    const seen = dal.getObservations({ asOf: 5000, asset: "BTC" });
    expect(seen).toHaveLength(1);
    expect(seen[0].observed_at).toBe(100);
    expect(seen[0].captured_at).toBe(5000);
    expect(seen[0].is_backfill).toBe(1);
  });

  it("a backfilled value identical to a forward one dedupes (no double-count)", () => {
    const first = dal.insertObservation(hist({ observedAt: 100, value: 0.01 }), 3000); // forward
    const back = dal.insertObservation(hist({ observedAt: 100, value: 0.01 }), 5000, true); // same datum, imported
    expect(first.inserted).toBe(true);
    expect(back.inserted).toBe(false);
    expect(dal.getObservations({ asOf: 9999, asset: "BTC" })).toHaveLength(1);
  });

  it("can filter reads by provenance", () => {
    dal.insertObservation(hist({ observedAt: 100 }), 5000); // forward
    dal.insertObservation(hist({ observedAt: 50, value: 0.09 }), 5000, true); // backfill
    expect(dal.getObservations({ asOf: 9999, isBackfill: true })).toHaveLength(1);
    expect(dal.getObservations({ asOf: 9999, isBackfill: false })).toHaveLength(1);
  });
});
