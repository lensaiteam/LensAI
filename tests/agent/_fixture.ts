import { openDb, type DB } from "@/lib/capture/db/client";
import { runMigrations } from "@/lib/capture/db/migrate";
import { createDal } from "@/lib/capture/db/dal";
import { normalizeAll } from "@/lib/factors/normalize";
import { computeRegimes } from "@/lib/factors/regimes";
import { runDivergence } from "@/lib/divergence/engine";
import { loadSeedFromFile } from "@/lib/mechanism/loader";
import { loadGraph } from "@/lib/mechanism/graph";
import { DAY } from "@/lib/factors/windows";

/**
 * Shared agent fixture: 400 days of BTC funding (rising → top of range) + OI, and
 * ETH funding that rises then collapses on the final day, computed at two anchors
 * so "what changed" has something to diff.
 */
export const ANCHOR_A = 398 * DAY;
export const ANCHOR_B = 399 * DAY;
export const NOW = ANCHOR_B + 1000;

export function computeAt(db: DB, anchor: number): void {
  normalizeAll(db, { asOf: anchor, slot: anchor });
  computeRegimes(db, { asOf: anchor, slot: anchor });
  runDivergence(db, { asOf: anchor, slot: anchor });
}

export function buildDb(): DB {
  const db = openDb(":memory:");
  runMigrations(db);
  const dal = createDal(db);
  for (let i = 0; i < 400; i++) {
    dal.insertObservation({ stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: i, observedAt: i * DAY }, i * DAY);
    dal.insertObservation({ stream: "open_interest", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: i * 10, observedAt: i * DAY }, i * DAY);
    dal.insertObservation({ stream: "funding_rate", source: "binance", asset: "ETH", instrument: "ETHUSDT", value: i === 399 ? -5 : i, observedAt: i * DAY }, i * DAY);
  }
  loadGraph(db, loadSeedFromFile(), 1000);
  computeAt(db, ANCHOR_A);
  computeAt(db, ANCHOR_B);
  return db;
}

export const BTC_FUNDING_REF = "pctl:funding_rate/binance/BTC/365d";
