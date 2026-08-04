import { describe, it, expect } from "vitest";
import { extremeStateFlag, type PercentileInput } from "@/lib/divergence/extremeState";
import { directionFromSeries, relationshipFlag, type EdgeInput } from "@/lib/divergence/relationships";
import { computeSignatures, type SignatureContext } from "@/lib/divergence/signatures";
import type { ResolvedPoint } from "@/lib/factors/stats";

const pct = (over: Partial<PercentileInput>): PercentileInput => ({
  stream: "funding_rate", source: "binance", asset: "BTC", window_id: "365d",
  status: "ok", percentile: 0.5, value: 1, n_obs: 500, vintage: "true_pit", ...over,
});

describe("extremeStateFlag", () => {
  it("ignores non-configured windows", () => {
    expect(extremeStateFlag(pct({ window_id: "90d" }))).toBeNull();
  });
  it("fires high at/above 0.95", () => {
    const f = extremeStateFlag(pct({ percentile: 0.97 }))!;
    expect(f.fired).toBe(true);
    expect(f.detail.direction).toBe("high");
    expect(f.magnitude).toBeCloseTo(0.02, 6);
  });
  it("fires low at/below 0.05", () => {
    expect(extremeStateFlag(pct({ percentile: 0.03 }))!.fired).toBe(true);
  });
  it("does not fire in the middle", () => {
    expect(extremeStateFlag(pct({ percentile: 0.6 }))!.fired).toBe(false);
  });
  it("is indeterminate on insufficient_history", () => {
    const f = extremeStateFlag(pct({ status: "insufficient_history", percentile: null, n_obs: 3 }))!;
    expect(f.status).toBe("indeterminate");
    expect(f.fired).toBe(false);
  });
});

function series(vals: [number, number, number][]): ResolvedPoint[] {
  // [observedAt, value, capturedAt]
  return vals.map(([o, v, c]) => ({ observedAt: o, value: v, capturedAt: c }));
}

describe("directionFromSeries", () => {
  const DAY = 86_400_000;
  it("detects up/down over the lookback", () => {
    const s = series([[0, 10, 0], [30 * DAY, 20, 30 * DAY]]);
    expect(directionFromSeries(s, 30 * DAY, 30 * DAY).dir).toBe("up");
    const s2 = series([[0, 20, 0], [30 * DAY, 10, 30 * DAY]]);
    expect(directionFromSeries(s2, 30 * DAY, 30 * DAY).dir).toBe("down");
  });
  it("returns unknown when a lookback point is missing", () => {
    expect(directionFromSeries(series([[30 * DAY, 20, 30 * DAY]]), 30 * DAY, 30 * DAY).dir).toBe("unknown");
  });
  it("flags current_vintage when a point was captured after the slot", () => {
    const s = series([[0, 10, 0], [30 * DAY, 20, 999 * DAY]]);
    expect(directionFromSeries(s, 30 * DAY, 30 * DAY).vintage).toBe("current_vintage");
  });
});

describe("relationshipFlag", () => {
  const edge = (polarity: string): EdgeInput => ({ id: "e", src: "a", dst: "b", polarity, channel: "c" });
  const up = { dir: "up" as const, from: 1, to: 2, vintage: "true_pit" as const };
  const down = { dir: "down" as const, from: 2, to: 1, vintage: "true_pit" as const };
  const flat = { dir: "flat" as const, from: 1, to: 1, vintage: "true_pit" as const };

  it("positive + same direction = consistent (not broken)", () => {
    expect(relationshipFlag(edge("positive"), up, up).fired).toBe(false);
  });
  it("positive + opposite = broken", () => {
    expect(relationshipFlag(edge("positive"), up, down).fired).toBe(true);
  });
  it("negative + opposite = consistent; negative + same = broken", () => {
    expect(relationshipFlag(edge("negative"), up, down).fired).toBe(false);
    expect(relationshipFlag(edge("negative"), up, up).fired).toBe(true);
  });
  it("conditional or flat/unknown -> indeterminate", () => {
    expect(relationshipFlag(edge("conditional"), up, down).status).toBe("indeterminate");
    expect(relationshipFlag(edge("positive"), up, flat).status).toBe("indeterminate");
  });
  it("propagates worst vintage", () => {
    const upCurrent = { ...up, vintage: "current_vintage" as const };
    expect(relationshipFlag(edge("positive"), upCurrent, up).vintage).toBe("current_vintage");
  });
});

describe("computeSignatures", () => {
  const ctx = (over: Partial<{ funding: number; oi: number; regime: string; oiStatus: "ok" | "insufficient_history" }>): SignatureContext => ({
    assets: ["BTC"],
    pctile: (stream) => {
      if (stream === "funding_rate") return { percentile: over.funding ?? 0.5, status: "ok", vintage: "true_pit" };
      if (stream === "open_interest") return { percentile: over.oi ?? 0.5, status: over.oiStatus ?? "ok", vintage: "true_pit" };
      return null;
    },
    regime: () => over.regime ?? "neutral",
  });

  const find = (flags: ReturnType<typeof computeSignatures>, key: string) => flags.find((f) => f.subject === `${key}/BTC`)!;

  it("leverage_led fires on elevated funding regime + high OI", () => {
    const f = find(computeSignatures(ctx({ regime: "elevated", oi: 0.85 })), "leverage_led");
    expect(f.fired).toBe(true);
  });
  it("leverage_led does not fire on neutral regime", () => {
    expect(find(computeSignatures(ctx({ regime: "neutral", oi: 0.85 })), "leverage_led").fired).toBe(false);
  });
  it("spot_led fires on non-elevated regime + calm OI", () => {
    expect(find(computeSignatures(ctx({ regime: "suppressed", oi: 0.3 })), "spot_led").fired).toBe(true);
  });
  it("fragile fires when leverage_led + funding stretched", () => {
    expect(find(computeSignatures(ctx({ regime: "elevated", oi: 0.85, funding: 0.96 })), "fragile").fired).toBe(true);
  });
  it("indeterminate when OI is insufficient", () => {
    expect(find(computeSignatures(ctx({ regime: "elevated", oiStatus: "insufficient_history" })), "leverage_led").status).toBe("indeterminate");
  });
  it("indeterminate when regime is unknown", () => {
    expect(find(computeSignatures(ctx({ regime: "unknown", oi: 0.9 })), "leverage_led").status).toBe("indeterminate");
  });
});
