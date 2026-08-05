import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, type DB } from "@/lib/capture/db/client";
import { runMigrations } from "@/lib/capture/db/migrate";
import { createDal } from "@/lib/capture/db/dal";
import { normalizeAll } from "@/lib/factors/normalize";
import { computeRegimes } from "@/lib/factors/regimes";
import { runDivergence } from "@/lib/divergence/engine";
import { loadSeedFromFile } from "@/lib/mechanism/loader";
import { loadGraph } from "@/lib/mechanism/graph";
import { gatherToken } from "@/lib/narrate/gather";
import { narrate } from "@/lib/narrate/orchestrator";
import { MockProvider } from "@/lib/narrate/provider";
import { DAY } from "@/lib/factors/windows";

let db: DB;
const ANCHOR = 399 * DAY;

beforeEach(() => {
  db = openDb(":memory:");
  runMigrations(db);
  const dal = createDal(db);
  for (let i = 0; i < 400; i++) {
    dal.insertObservation({ stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: i, observedAt: i * DAY }, i * DAY);
    dal.insertObservation({ stream: "open_interest", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: i * 10, observedAt: i * DAY }, i * DAY);
  }
  normalizeAll(db, { asOf: ANCHOR, slot: ANCHOR });
  computeRegimes(db, { asOf: ANCHOR, slot: ANCHOR });
  runDivergence(db, { asOf: ANCHOR, slot: ANCHOR });
  loadGraph(db, loadSeedFromFile(), 1000);
});
afterEach(() => db.close());

describe("gather (point-in-time)", () => {
  it("assembles facts + edge ids at the anchor and nothing before compute", () => {
    const ctx = gatherToken(db, "BTC", ANCHOR + 1000);
    expect(ctx.facts.some((f) => f.ref.includes("funding_rate/binance/BTC/365d"))).toBe(true);
    expect(ctx.edgeIds.has("funding_to_basis")).toBe(true);
    expect(ctx.contextText).toContain("BTC");

    const early = gatherToken(db, "BTC", 10 * DAY);
    expect(early.facts).toHaveLength(0); // no factor state computed at that anchor
  });
});

const goodBrief = {
  headline: "BTC — funding stretched",
  claims: [
    { text: "BTC perp funding sits at the top of its 365-day range.", basis: "measured", refs: ["pctl:funding_rate/binance/BTC/365d"], numbers: [{ value: 1.0, unit: "percentile", ref: "pctl:funding_rate/binance/BTC/365d" }] },
    { text: "Open interest is unusually low at the 3rd percentile.", basis: "measured", refs: [], numbers: [{ value: 0.03 }] }, // unsupported number
    { text: "You should buy BTC now.", basis: "conjecture", refs: [], numbers: [] }, // advisory
    { text: "Elevated funding draws basis-trade capital via the documented channel.", basis: "mechanical", refs: ["funding_to_basis"], numbers: [] }, // real edge
    { text: "This ties into ETF gamma exposure.", basis: "mechanical", refs: ["made_up_edge"], numbers: [] }, // fake edge
    { text: "Positioning could unwind quickly if macro turns.", basis: "conjecture", refs: [], numbers: [] }, // kept conjecture
  ],
};

describe("narrate pipeline (fail-closed)", () => {
  it("keeps verified/non-advisory claims and drops the rest", async () => {
    const res = await narrate(db, new MockProvider(goodBrief), { surface: "token", asset: "BTC", asOf: ANCHOR });
    expect(res.kept).toBe(3);
    expect(res.dropped).toBe(3);
    const reasons = res.audit.filter((a) => !a.kept).map((a) => a.reason);
    expect(reasons).toContain("unverified-number");
    expect(reasons.some((r) => r?.startsWith("advisory:"))).toBe(true);
    expect(reasons).toContain("mechanical-no-edge");
  });

  it("renders only surviving claims — advisory text never reaches the output", async () => {
    const res = await narrate(db, new MockProvider(goodBrief), { surface: "token", asset: "BTC", asOf: ANCHOR });
    expect(res.text).toContain("top of its 365-day range");
    expect(res.text).toContain("Conjecture: Positioning could unwind");
    expect(res.text).toContain("not financial advice");
    expect(res.text).not.toContain("should buy");
    expect(res.text).not.toContain("ETF gamma"); // fake-edge mechanical dropped
  });

  it("fails closed on a malformed claim (missing basis)", async () => {
    const bad = { claims: [{ text: "a claim with no basis field" }] };
    await expect(narrate(db, new MockProvider(bad), { surface: "market", asOf: ANCHOR })).rejects.toThrow(/fail-closed/);
  });

  it("token narration requires an asset", async () => {
    await expect(narrate(db, new MockProvider(goodBrief), { surface: "token", asOf: ANCHOR })).rejects.toThrow(/requires an asset/);
  });
});
