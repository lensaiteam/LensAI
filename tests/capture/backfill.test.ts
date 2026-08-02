import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, type DB } from "@/lib/capture/db/client";
import { runMigrations } from "@/lib/capture/db/migrate";
import { createDal } from "@/lib/capture/db/dal";
import { runBackfillJob, type BackfillJobResult } from "@/lib/capture/backfill";
import { parseFundingHistory, parseOiHistory, parseMarketChart, parseFredSeries, type BackfillAdapter } from "@/lib/capture/adapters/backfill";
import type { FactorSource } from "@/lib/capture/sources";

describe("backfill parsers (pure)", () => {
  it("parseFundingHistory maps each historical funding tick with its fundingTime", () => {
    const obs = parseFundingHistory("BTCUSDT", [
      { symbol: "BTCUSDT", fundingTime: 1000, fundingRate: "0.0001" },
      { symbol: "BTCUSDT", fundingTime: 2000, fundingRate: "-0.0002" },
    ]);
    expect(obs).toHaveLength(2);
    expect(obs[0]).toMatchObject({ stream: "funding_rate", source: "binance", asset: "BTC", observedAt: 1000, value: 0.0001 });
    expect(obs[1].value).toBeCloseTo(-0.0002, 8);
  });

  it("parseOiHistory carries USD value in metadata", () => {
    const obs = parseOiHistory("ETHUSDT", [{ symbol: "ETHUSDT", sumOpenInterest: "1000", sumOpenInterestValue: "3400000", timestamp: 5000 }]);
    expect(obs[0]).toMatchObject({ stream: "open_interest", asset: "ETH", value: 1000, observedAt: 5000 });
    expect((obs[0].metadata as Record<string, unknown>).openInterestValueUsd).toBe(3400000);
  });

  it("parseMarketChart emits spot_price + spot_volume points", () => {
    const obs = parseMarketChart("bitcoin", { prices: [[1000, 68000], [2000, 69000]], total_volumes: [[1000, 4e10]] });
    expect(obs.filter((o) => o.stream === "spot_price")).toHaveLength(2);
    expect(obs.filter((o) => o.stream === "spot_volume")).toHaveLength(1);
    expect(obs[0]).toMatchObject({ asset: "bitcoin", observedAt: 1000, value: 68000 });
  });

  it("parseFredSeries skips missing '.' prints (never fabricates)", () => {
    const { observations, skipped } = parseFredSeries({ series: "DGS10", asset: "DGS10", stream: "macro_rate" }, [
      { date: "2026-07-30", value: "4.30" },
      { date: "2026-07-31", value: "." },
      { date: "2026-08-01", value: "4.36" },
    ]);
    expect(observations).toHaveLength(2);
    expect(skipped).toBe(1);
    expect(observations[0].observedAt).toBe(Date.parse("2026-07-30T00:00:00Z"));
    expect(observations[0].unit).toBe("percent");
  });
});

describe("backfill runner", () => {
  let db: DB;
  const cfg: FactorSource = { id: "binance_funding", adapter: "binanceFunding", stream: "funding_rate", source: "binance", instruments: ["BTCUSDT"], interval_sec: 3600 };

  beforeEach(() => {
    db = openDb(":memory:");
    runMigrations(db);
  });
  afterEach(() => db.close());

  const fakeAdapter: BackfillAdapter = async () => ({
    observations: [
      { stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: 0.0001, observedAt: 1000 },
      { stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: 0.0002, observedAt: 2000 },
    ],
    errors: [],
  });

  it("inserts history flagged is_backfill=1 with captured_at=now", async () => {
    const dal = createDal(db);
    const now = 9_000_000;
    const res: BackfillJobResult = await runBackfillJob(db, dal, cfg, fakeAdapter, now);
    expect(res.status).toBe("ok");
    expect(res.rowsWritten).toBe(2);

    const rows = dal.getObservations({ asOf: 9_999_999, asset: "BTC" });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.is_backfill === 1)).toBe(true);
    expect(rows.every((r) => r.captured_at === now)).toBe(true);
    expect(rows.map((r) => r.observed_at).sort((a, b) => a - b)).toEqual([1000, 2000]);

    // Recorded in ingest_runs as a backfill job (slot null).
    const run = db.prepare("SELECT job, slot, status, rows_written FROM ingest_runs WHERE job = 'backfill:binance_funding'").get() as { job: string; slot: number | null; status: string; rows_written: number };
    expect(run).toMatchObject({ status: "ok", rows_written: 2, slot: null });
  });

  it("is idempotent: a second run dedupes to 0 written", async () => {
    const dal = createDal(db);
    await runBackfillJob(db, dal, cfg, fakeAdapter, 9_000_000);
    const second = await runBackfillJob(db, dal, cfg, fakeAdapter, 9_500_000);
    expect(second.rowsWritten).toBe(0);
    expect(second.rowsDeduped).toBe(2);
    expect(dal.getObservations({ asOf: 9_999_999, asset: "BTC" })).toHaveLength(2);
  });

  it("records errors as partial/error without throwing", async () => {
    const dal = createDal(db);
    const erroring: BackfillAdapter = async () => ({ observations: [], errors: ["HTTP 429"] });
    const res = await runBackfillJob(db, dal, cfg, erroring, 1000);
    expect(res.status).toBe("error");
    expect(res.errors).toContain("HTTP 429");
  });
});
