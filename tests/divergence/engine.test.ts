import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, type DB } from "@/lib/capture/db/client";
import { runMigrations } from "@/lib/capture/db/migrate";
import { createDal } from "@/lib/capture/db/dal";
import { normalizeAll } from "@/lib/factors/normalize";
import { computeRegimes } from "@/lib/factors/regimes";
import { loadSeedFromFile } from "@/lib/mechanism/loader";
import { loadGraph } from "@/lib/mechanism/graph";
import { runDivergence } from "@/lib/divergence/engine";
import { createDivergenceDal } from "@/lib/divergence/derivedDal";
import { DAY } from "@/lib/factors/windows";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  runMigrations(db);
});
afterEach(() => db.close());

// Seed funding + OI for BTC where the current value tops its own range.
function seed() {
  const dal = createDal(db);
  for (let i = 0; i < 400; i++) {
    dal.insertObservation({ stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: i, observedAt: i * DAY }, i * DAY);
    dal.insertObservation({ stream: "open_interest", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: i * 10, observedAt: i * DAY }, i * DAY);
  }
}

const ANCHOR = 399 * DAY;

function prep() {
  seed();
  normalizeAll(db, { asOf: ANCHOR, slot: ANCHOR });
  computeRegimes(db, { asOf: ANCHOR, slot: ANCHOR });
  loadGraph(db, loadSeedFromFile(), 1000); // graph-v1 loaded before the anchor
}

describe("divergence engine", () => {
  it("fires extreme_state on a top-of-range factor and records it", () => {
    prep();
    runDivergence(db, { asOf: ANCHOR, slot: ANCHOR });
    const div = createDivergenceDal(db);
    const extreme = div.get({ kind: "extreme_state", fired: true }).map((r) => r.subject);
    expect(extreme).toContain("funding_rate/binance/BTC");
    expect(extreme).toContain("open_interest/binance/BTC");
    const fr = div.get({ kind: "extreme_state" }).find((r) => r.subject === "funding_rate/binance/BTC" && r.window_id === "365d")!;
    expect(fr.detail.direction).toBe("high");
    expect(fr.vintage).toBe("true_pit");
  });

  it("computes structural signatures (leverage_led + fragile fire; spot_led does not)", () => {
    prep();
    runDivergence(db, { asOf: ANCHOR, slot: ANCHOR });
    const div = createDivergenceDal(db);
    const sig = Object.fromEntries(div.get({ kind: "structural_signature" }).map((r) => [r.subject, r.fired]));
    expect(sig["leverage_led/BTC"]).toBe(true);
    expect(sig["fragile/BTC"]).toBe(true);
    expect(sig["spot_led/BTC"]).toBe(false);
  });

  it("broken_relationship is graph-driven and honestly zero for graph-v1 (no factor<->factor edges)", () => {
    prep();
    runDivergence(db, { asOf: ANCHOR, slot: ANCHOR });
    expect(createDivergenceDal(db).get({ kind: "broken_relationship" })).toHaveLength(0);
  });

  it("is idempotent (INSERT OR REPLACE by natural key)", () => {
    prep();
    runDivergence(db, { asOf: ANCHOR, slot: ANCHOR });
    const before = (db.prepare("SELECT count(*) c FROM factor_divergences").get() as { c: number }).c;
    runDivergence(db, { asOf: ANCHOR, slot: ANCHOR });
    const after = (db.prepare("SELECT count(*) c FROM factor_divergences").get() as { c: number }).c;
    expect(after).toBe(before);
  });

  it("writes nothing meaningful before any factor state exists (point-in-time)", () => {
    prep();
    // Anchor far before the derived rows' as_of -> no percentiles at that anchor.
    const rows = runDivergence(db, { asOf: 10 * DAY, slot: 10 * DAY });
    expect(rows.filter((r) => r.fired)).toHaveLength(0);
  });
});
