import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, type DB } from "@/lib/capture/db/client";
import { runMigrations } from "@/lib/capture/db/migrate";
import { persistBrief, listBriefs } from "@/lib/narrate/briefs";
import type { NarrateResult } from "@/lib/narrate/orchestrator";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  runMigrations(db);
});
afterEach(() => db.close());

const result: NarrateResult = {
  surface: "token",
  asset: "BTC",
  asOf: 1000,
  text: "## BTC\nFunding is stretched.\n\n_not financial advice_",
  audit: [
    { text: "Funding is stretched.", basis: "measured", kept: true, refs: ["pctl:funding_rate/binance/BTC/365d"] },
    { text: "You should buy.", basis: "conjecture", kept: false, reason: "advisory:you-should", refs: [] },
  ],
  kept: 1,
  dropped: 1,
  provider: "mock",
};

describe("briefs (calibration record)", () => {
  it("persists a brief with the surviving claims' input refs", () => {
    persistBrief(db, result, 5000);
    const rows = listBriefs(db, { asset: "BTC" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ surface: "token", asset: "BTC", as_of: 1000, claims_kept: 1, claims_dropped: 1, code_version: "narrate-v1" });
    expect(rows[0].input_refs).toEqual(["pctl:funding_rate/binance/BTC/365d"]);
  });

  it("is append-only (immutable calibration record)", () => {
    persistBrief(db, result, 5000);
    expect(() => db.prepare("UPDATE briefs SET text = 'x'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM briefs").run()).toThrow(/append-only/);
  });
});
