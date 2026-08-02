import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

function article(source: string, hashText: string) {
  return { source, url: `https://x/${hashText}`, extractedText: hashText };
}

describe("INVARIANT 2 — point-in-time reads", () => {
  it("never returns rows captured after as_of", () => {
    dal.insertArticle(article("coindesk", "early"), 1000);
    dal.insertArticle(article("coindesk", "late"), 3000);

    const seenAt2000 = dal.getArticles({ asOf: 2000 });
    expect(seenAt2000.map((r) => r.extracted_text)).toEqual(["early"]);

    const seenAt3000 = dal.getArticles({ asOf: 3000 });
    expect(seenAt3000.map((r) => r.extracted_text).sort()).toEqual(["early", "late"]);
  });

  it("includes the boundary row where captured_at == as_of", () => {
    dal.insertArticle(article("coindesk", "boundary"), 1000);
    expect(dal.getArticles({ asOf: 1000 })).toHaveLength(1);
    expect(dal.getArticles({ asOf: 999 })).toHaveLength(0);
  });

  it("gates observations by as_of too", () => {
    const obs: ObservationInput = { stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: 0.01, observedAt: 500 };
    dal.insertObservation(obs, 5000); // captured in the future relative to the read
    expect(dal.getObservations({ asOf: 1000, asset: "BTC" })).toHaveLength(0);
    expect(dal.getObservations({ asOf: 5000, asset: "BTC" })).toHaveLength(1);
  });

  it("refuses a read without as_of (runtime guard)", () => {
    // @ts-expect-error asOf is required by the type; prove the runtime guard too.
    expect(() => dal.getArticles({})).toThrow(/asOf/);
  });
});

describe("INVARIANT 1/3 — dedupe vs revisions at the DAL", () => {
  it("dedupes an identical article re-fetch (same source + content)", () => {
    const first = dal.insertArticle(article("coindesk", "same body"), 1000);
    const second = dal.insertArticle(article("coindesk", "same body"), 2000);
    expect(first.inserted).toBe(true);
    expect(second.inserted).toBe(false);
    expect(dal.getArticles({ asOf: 9999 })).toHaveLength(1);
  });

  it("keeps the same body from a DIFFERENT source (per-source dedupe)", () => {
    dal.insertArticle(article("coindesk", "wire story"), 1000);
    const other = dal.insertArticle(article("blockworks", "wire story"), 1000);
    expect(other.inserted).toBe(true);
    expect(dal.getArticles({ asOf: 9999 })).toHaveLength(2);
  });

  it("appends a revised observation (same observed_at, new value) but dedupes identical", () => {
    const base: ObservationInput = { stream: "macro_rate", source: "fred", asset: "DGS10", observedAt: 100, value: 4.10, unit: "percent" };

    const v1 = dal.insertObservation(base, 1000);
    const revised = dal.insertObservation({ ...base, value: 4.15 }, 2000); // FRED revision
    const identical = dal.insertObservation({ ...base }, 3000); // idempotent re-fetch

    expect(v1.inserted).toBe(true);
    expect(revised.inserted).toBe(true); // revision APPENDS
    expect(identical.inserted).toBe(false); // same payload dedupes

    const rows = dal.getObservations({ asOf: 9999, asset: "DGS10" });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.observed_at === 100)).toBe(true);
    expect(rows.map((r) => r.value).sort()).toEqual([4.1, 4.15]);
  });

  it("resolves the value visible at an as_of (latest captured_at <= as_of)", () => {
    const base: ObservationInput = { stream: "macro_rate", source: "fred", asset: "DGS10", observedAt: 100, value: 4.10 };
    dal.insertObservation(base, 1000);
    dal.insertObservation({ ...base, value: 4.15 }, 2000);

    // Before the revision landed, only the original value is visible.
    const before = dal.getObservations({ asOf: 1500, asset: "DGS10" });
    expect(before.map((r) => r.value)).toEqual([4.1]);
    // After, the latest-captured revision is the head.
    const after = dal.getObservations({ asOf: 2500, asset: "DGS10" });
    expect(after[0].value).toBe(4.15);
  });
});
