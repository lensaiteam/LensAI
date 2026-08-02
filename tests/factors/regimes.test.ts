import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, type DB } from "@/lib/capture/db/client";
import { runMigrations } from "@/lib/capture/db/migrate";
import { createDal } from "@/lib/capture/db/dal";
import { normalizeAll } from "@/lib/factors/normalize";
import { computeRegimes, REGIME_RULE_VERSION } from "@/lib/factors/regimes";
import { DAY } from "@/lib/factors/windows";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  runMigrations(db);
});
afterEach(() => db.close());

// Seed 400 daily funding points for BTC where the CURRENT value sits at a chosen
// spot in its own distribution.
function seedFunding(currentIsMax: boolean) {
  const dal = createDal(db);
  for (let i = 0; i < 400; i++) {
    // values 0..399; if currentIsMax, last day (399) keeps the max; else make the
    // last day the minimum so its percentile is low.
    const value = i;
    dal.insertObservation({ stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value, observedAt: i * DAY }, i * DAY);
  }
  if (!currentIsMax) {
    // Add a later slot whose value is below everything -> current percentile low.
    dal.insertObservation({ stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: -1, observedAt: 400 * DAY }, 400 * DAY);
  }
}

describe("regime tags v1", () => {
  it("funding at the top of its range -> elevated (stamped rule_version + params)", () => {
    seedFunding(true);
    const asOf = 399 * DAY;
    const slot = 399 * DAY;
    normalizeAll(db, { asOf, slot });
    const rows = computeRegimes(db, { asOf, slot });
    const funding = rows.find((r) => r.regime_key === "funding_regime" && r.asset === "BTC")!;
    expect(funding.regime_value).toBe("elevated");
    expect(funding.rule_version).toBe(REGIME_RULE_VERSION);
    expect(funding.params).toMatchObject({ stream: "funding_rate", window: "365d" });
  });

  it("funding at the bottom of its range -> suppressed", () => {
    seedFunding(false);
    const asOf = 400 * DAY;
    const slot = 400 * DAY;
    normalizeAll(db, { asOf, slot });
    const rows = computeRegimes(db, { asOf, slot });
    expect(rows.find((r) => r.regime_key === "funding_regime" && r.asset === "BTC")!.regime_value).toBe("suppressed");
  });

  it("insufficient history -> unknown, never a guess", () => {
    const dal = createDal(db);
    for (let i = 0; i < 5; i++) dal.insertObservation({ stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: i, observedAt: i * DAY }, i * DAY);
    const asOf = 4 * DAY;
    normalizeAll(db, { asOf, slot: 4 * DAY });
    const rows = computeRegimes(db, { asOf, slot: 4 * DAY });
    expect(rows.find((r) => r.regime_key === "funding_regime" && r.asset === "BTC")!.regime_value).toBe("unknown");
  });

  it("is idempotent (derived upsert)", () => {
    seedFunding(true);
    const asOf = 399 * DAY;
    normalizeAll(db, { asOf, slot: 399 * DAY });
    computeRegimes(db, { asOf, slot: 399 * DAY });
    computeRegimes(db, { asOf, slot: 399 * DAY });
    const n = (db.prepare("SELECT count(*) c FROM factor_regimes WHERE regime_key='funding_regime' AND asset='BTC'").get() as { c: number }).c;
    expect(n).toBe(1);
  });
});
