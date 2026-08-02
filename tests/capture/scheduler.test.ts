import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, type DB } from "@/lib/capture/db/client";
import { runMigrations } from "@/lib/capture/db/migrate";
import { runJobs, slotFor, type Job } from "@/lib/capture/scheduler";
import { successfulRun, lastSuccessPerSource } from "@/lib/capture/db/runs";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  runMigrations(db);
});
afterEach(() => db.close());

// A deterministic factor job whose adapter records how many times it ran.
function fakeFactorJob(overrides: Partial<{ value: number; errors: string[] }> = {}) {
  let calls = 0;
  const job: Job = {
    id: "factor:fake",
    kind: "factor",
    source: "fake",
    intervalSec: 3600,
    cfg: { id: "fake", adapter: "fake", stream: "funding_rate", source: "fake", interval_sec: 3600 },
    run: async (_cfg, ctx) => {
      calls++;
      return {
        observations: [
          { stream: "funding_rate", source: "fake", asset: "BTC", instrument: "BTCUSDT", value: overrides.value ?? 0.01, observedAt: ctx.slot },
        ],
        errors: overrides.errors ?? [],
      };
    },
  };
  return { job, calls: () => calls };
}

describe("scheduler", () => {
  it("slotFor floors to the interval boundary", () => {
    expect(slotFor(3_600_500, 3600)).toBe(3_600_000);
    expect(slotFor(7_199_999, 3600)).toBe(3_600_000);
    expect(slotFor(7_200_000, 3600)).toBe(7_200_000);
  });

  it("is idempotent within a slot: re-running writes 0 new rows", async () => {
    const now = slotFor(Date.now(), 3600) + 10;
    const { job, calls } = fakeFactorJob();

    const first = await runJobs(db, [job], now);
    expect(first[0].status).toBe("ok");
    expect(first[0].rowsWritten).toBe(1);

    const second = await runJobs(db, [job], now); // same slot
    expect(second[0].status).toBe("skipped");
    expect(second[0].rowsWritten).toBe(0);
    expect(calls()).toBe(1); // adapter not even called the second time

    const count = db.prepare("SELECT count(*) c FROM factor_observations").get() as { c: number };
    expect(count.c).toBe(1);
  });

  it("restart-safe: a fresh scheduler over the same DB still skips a done slot", async () => {
    const now = slotFor(Date.now(), 3600) + 10;
    const a = fakeFactorJob();
    await runJobs(db, [a.job], now);
    // Simulate a restart: brand-new job object, same DB (state lives in ingest_runs).
    const b = fakeFactorJob();
    const res = await runJobs(db, [b.job], now);
    expect(res[0].status).toBe("skipped");
    expect(b.calls()).toBe(0);
    expect(successfulRun(db, "factor:fake", slotFor(now, 3600))).toBeTruthy();
  });

  it("advances to the next slot", async () => {
    const base = slotFor(Date.now(), 3600);
    const { job } = fakeFactorJob();
    await runJobs(db, [job], base + 10);
    const next = await runJobs(db, [job], base + 3_600_000 + 10); // next hour
    expect(next[0].status).toBe("ok");
    expect(next[0].rowsWritten).toBe(1);
    const count = db.prepare("SELECT count(*) c FROM factor_observations").get() as { c: number };
    expect(count.c).toBe(2);
  });

  it("records failures (non-silent fail-soft) and does not mark the slot done", async () => {
    const now = slotFor(Date.now(), 3600) + 10;
    // Adapter returns an error and no data -> status error.
    const failing: Job = {
      id: "factor:down", kind: "factor", source: "down", intervalSec: 3600,
      cfg: { id: "down", adapter: "x", stream: "s", source: "down", interval_sec: 3600 },
      run: async () => ({ observations: [], errors: ["HTTP 503 for down"] }),
    };
    const res = await runJobs(db, [failing], now);
    expect(res[0].status).toBe("error");

    const row = db.prepare("SELECT status, error FROM ingest_runs WHERE job = 'factor:down'").get() as { status: string; error: string };
    expect(row.status).toBe("error");
    expect(row.error).toMatch(/503/);

    // An errored slot is NOT considered done -> it will be retried next tick.
    expect(successfulRun(db, "factor:down", slotFor(now, 3600))).toBeUndefined();
    expect(lastSuccessPerSource(db).find((r) => r.source === "down")).toBeUndefined();
  });

  it("partial: some data + some errors", async () => {
    const now = slotFor(Date.now(), 3600) + 10;
    const partial: Job = {
      id: "factor:mixed", kind: "factor", source: "mixed", intervalSec: 3600,
      cfg: { id: "mixed", adapter: "x", stream: "funding_rate", source: "mixed", interval_sec: 3600 },
      run: async (_c, ctx) => ({
        observations: [{ stream: "funding_rate", source: "mixed", asset: "ETH", observedAt: ctx.slot, value: 0.02 }],
        errors: ["mixed SOLUSDT: HTTP 418"],
      }),
    };
    const res = await runJobs(db, [partial], now);
    expect(res[0].status).toBe("partial");
    expect(res[0].rowsWritten).toBe(1);
  });
});
