import { describe, it, expect } from "vitest";
import { resolveSeries, percentileRankLE, computeWindowStat, type RawPoint } from "@/lib/factors/stats";
import { DAY } from "@/lib/factors/windows";

describe("resolveSeries", () => {
  it("keeps the latest revision per observed_at knowable at asOf, drops nulls", () => {
    const rows: RawPoint[] = [
      { observed_at: 100, value: 4.1, captured_at: 1000 },
      { observed_at: 100, value: 4.15, captured_at: 2000 }, // revision
      { observed_at: 200, value: 4.2, captured_at: 1500 },
      { observed_at: 300, value: null, captured_at: 1500 }, // dropped
    ];
    // asOf before the revision: only the original value is knowable.
    expect(resolveSeries(rows, 1500).find((p) => p.observedAt === 100)!.value).toBe(4.1);
    // asOf after the revision: the revised value wins.
    expect(resolveSeries(rows, 2500).find((p) => p.observedAt === 100)!.value).toBe(4.15);
    expect(resolveSeries(rows, 2500).some((p) => p.observedAt === 300)).toBe(false);
  });
});

describe("percentileRankLE", () => {
  it("counts values <= x over n", () => {
    expect(percentileRankLE([1, 2, 3, 4], 3)).toBe(0.75);
    expect(percentileRankLE([1, 2, 3, 4], 4)).toBe(1);
    expect(percentileRankLE([], 5)).toBe(0);
  });
});

// Helper: n points, one per day up to day n-1, all captured at their observed time.
function daily(n: number, valueAt: (i: number) => number, capturedOffset = 0): RawPoint[] {
  return Array.from({ length: n }, (_, i) => ({ observed_at: i * DAY, value: valueAt(i), captured_at: i * DAY + capturedOffset }));
}

describe("computeWindowStat", () => {
  it("emits insufficient_history below MIN_OBS (value kept, percentile null)", () => {
    const resolved = resolveSeries(daily(10, (i) => i), 9 * DAY);
    const s = computeWindowStat(resolved, 9 * DAY, null, 30);
    expect(s.status).toBe("insufficient_history");
    expect(s.value).toBe(9);
    expect(s.percentile).toBeNull();
    expect(s.nObs).toBe(10);
  });

  it("computes a full-window percentile of the current value", () => {
    // values 0..99 by day; current (day 99) is the max -> percentile 1.0
    const resolved = resolveSeries(daily(100, (i) => i), 99 * DAY);
    const s = computeWindowStat(resolved, 99 * DAY, null, 30);
    expect(s.status).toBe("ok");
    expect(s.value).toBe(99);
    expect(s.percentile).toBe(1);
    expect(s.nObs).toBe(100);
    expect(s.vintage).toBe("true_pit");
  });

  it("windows on observed_at: a 90d lookback excludes older points", () => {
    const resolved = resolveSeries(daily(200, (i) => i), 199 * DAY);
    const T = 199 * DAY;
    const full = computeWindowStat(resolved, T, null, 30);
    const w90 = computeWindowStat(resolved, T, 90 * DAY, 30);
    expect(full.nObs).toBe(200);
    expect(w90.nObs).toBeLessThan(full.nObs); // only ~90 most-recent days
    expect(w90.nObs).toBe(90); // observed_at in (T-90d, T]
  });

  it("state is the latest observed_at <= T; staleness = T - that observed_at", () => {
    const resolved = resolveSeries(daily(50, (i) => i * 2), 49 * DAY);
    // Evaluate 3 days after the last observation -> stale by 3 days.
    const T = 49 * DAY + 3 * DAY;
    const s = computeWindowStat(resolved, T, null, 30);
    expect(s.stateObservedAt).toBe(49 * DAY);
    expect(s.value).toBe(98);
    expect(s.stalenessMs).toBe(3 * DAY);
  });

  it("marks current_vintage when a window input was captured AFTER the slot (backfill/late revision)", () => {
    // 40 daily points, but all captured 'now' (far after their observed_at) -> backfilled history.
    const backfilled: RawPoint[] = Array.from({ length: 40 }, (_, i) => ({ observed_at: i * DAY, value: i, captured_at: 999 * DAY }));
    const resolved = resolveSeries(backfilled, 999 * DAY);
    const T = 39 * DAY; // slot in the historical range
    const s = computeWindowStat(resolved, T, null, 30);
    expect(s.status).toBe("ok");
    expect(s.vintage).toBe("current_vintage"); // captured_at (999d) > T
  });

  it("marks true_pit when every input was captured at/<= the slot", () => {
    const live: RawPoint[] = Array.from({ length: 40 }, (_, i) => ({ observed_at: i * DAY, value: i, captured_at: i * DAY }));
    const resolved = resolveSeries(live, 39 * DAY);
    const s = computeWindowStat(resolved, 39 * DAY, null, 30);
    expect(s.vintage).toBe("true_pit");
  });

  it("a late revision to the current value flips vintage to current_vintage", () => {
    const rows: RawPoint[] = Array.from({ length: 40 }, (_, i) => ({ observed_at: i * DAY, value: i, captured_at: i * DAY }));
    // revise the last point, captured AFTER its slot but knowable at run-as_of
    rows.push({ observed_at: 39 * DAY, value: 99, captured_at: 39 * DAY + 5 * DAY });
    const resolved = resolveSeries(rows, 100 * DAY);
    const s = computeWindowStat(resolved, 39 * DAY, null, 30);
    expect(s.value).toBe(99); // uses the best available (revised) value
    expect(s.vintage).toBe("current_vintage"); // ...but flags it used hindsight
  });
});
