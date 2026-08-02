import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, type DB } from "@/lib/capture/db/client";
import { runMigrations } from "@/lib/capture/db/migrate";
import { createDal } from "@/lib/capture/db/dal";
import { normalizeTarget, normalizeAll, discoverTargets } from "@/lib/factors/normalize";
import { createDerivedDal } from "@/lib/factors/derivedDal";
import { DAY } from "@/lib/factors/windows";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  runMigrations(db);
});
afterEach(() => db.close());

// Seed a daily funding series for BTC: value == day index, captured at observed
// time (forward) unless capturedOffset given.
function seedDaily(n: number, opts: { capturedAt?: (i: number) => number } = {}) {
  const dal = createDal(db);
  for (let i = 0; i < n; i++) {
    dal.insertObservation(
      { stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: i, observedAt: i * DAY },
      opts.capturedAt ? opts.capturedAt(i) : i * DAY,
      opts.capturedAt !== undefined, // mark backfill when captured out-of-band
    );
  }
}

const target = { stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT" };

describe("migration 0003 derived tables", () => {
  it("creates factor_percentiles/factor_regimes and records the migration", () => {
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((t) => t.name);
    expect(tables).toContain("factor_percentiles");
    expect(tables).toContain("factor_regimes");
    const v = (db.prepare("SELECT version FROM schema_migrations").all() as { version: string }[]).map((r) => r.version);
    expect(v).toContain("0003_derived_factor_state");
  });
});

describe("normalizeTarget", () => {
  it("writes one row per window, stamped with code_version + params + vintage", () => {
    seedDaily(400);
    const slot = 399 * DAY;
    const rows = normalizeTarget(db, target, { asOf: 399 * DAY, slot });
    expect(rows.map((r) => r.window_id).sort()).toEqual(["365d", "90d", "full"]);
    for (const r of rows) {
      expect(r.code_version).toBe("pctl-v1");
      expect(r.params).toMatchObject({ method: "rank-le" });
      expect(r.as_of).toBe(399 * DAY);
    }
    // current value (day 399) is the max in every window -> percentile 1.0, true_pit
    const full = rows.find((r) => r.window_id === "full")!;
    expect(full.status).toBe("ok");
    expect(full.percentile).toBe(1);
    expect(full.n_obs).toBe(400);
    expect(full.vintage).toBe("true_pit");
    // 90d window has fewer observations than full
    expect(rows.find((r) => r.window_id === "90d")!.n_obs).toBe(90);
  });

  it("emits insufficient_history for a thin window (below MIN_OBS)", () => {
    seedDaily(400);
    const rows = normalizeTarget(db, target, { asOf: 400 * DAY, slot: 400 * DAY, windows: [{ id: "5d", lookbackMs: 5 * DAY }] });
    const w = rows[0];
    expect(w.status).toBe("insufficient_history");
    expect(w.percentile).toBeNull();
    expect(w.n_obs).toBeLessThan(30);
  });

  it("persists to the derived table and is idempotent (INSERT OR REPLACE)", () => {
    seedDaily(400);
    normalizeTarget(db, target, { asOf: 399 * DAY, slot: 399 * DAY });
    normalizeTarget(db, target, { asOf: 399 * DAY, slot: 399 * DAY }); // re-run
    const derived = createDerivedDal(db);
    const stored = derived.getPercentiles({ stream: "funding_rate", asset: "BTC", as_of: 399 * DAY });
    expect(stored).toHaveLength(3); // 3 windows, not 6
  });

  it("as_of gates the distribution (INV-2): later-captured data is invisible to an earlier anchor", () => {
    // 40 points captured live, plus a revision to day 39 captured much later.
    seedDaily(40);
    createDal(db).insertObservation(
      { stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: 999, observedAt: 39 * DAY },
      100 * DAY, // captured far in the future
    );
    // Anchor before the revision was captured -> original value, true_pit.
    const early = normalizeTarget(db, target, { asOf: 50 * DAY, slot: 39 * DAY }).find((r) => r.window_id === "full")!;
    expect(early.value).toBe(39);
    expect(early.vintage).toBe("true_pit");
    // Anchor after the revision -> revised value visible, and it's current_vintage.
    const late = normalizeTarget(db, target, { asOf: 200 * DAY, slot: 39 * DAY }).find((r) => r.window_id === "full")!;
    expect(late.value).toBe(999);
    expect(late.vintage).toBe("current_vintage");
  });

  it("backfilled history (captured after the slot) is marked current_vintage", () => {
    seedDaily(40, { capturedAt: () => 500 * DAY }); // all imported now
    const r = normalizeTarget(db, target, { asOf: 500 * DAY, slot: 39 * DAY }).find((x) => x.window_id === "full")!;
    expect(r.status).toBe("ok");
    expect(r.vintage).toBe("current_vintage");
  });
});

describe("normalizeAll + discoverTargets", () => {
  it("discovers distinct series and normalizes each", () => {
    const dal = createDal(db);
    for (let i = 0; i < 40; i++) {
      dal.insertObservation({ stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: i, observedAt: i * DAY }, i * DAY);
      dal.insertObservation({ stream: "stablecoin_float", source: "defillama", asset: "TOTAL", value: i * 1e9, observedAt: i * DAY }, i * DAY);
    }
    const asOf = 39 * DAY;
    expect(discoverTargets(db, asOf)).toHaveLength(2);
    const rows = normalizeAll(db, { asOf, slot: 39 * DAY });
    expect(rows).toHaveLength(6); // 2 series x 3 windows
    expect(new Set(rows.map((r) => r.asset))).toEqual(new Set(["BTC", "TOTAL"]));
  });
});
