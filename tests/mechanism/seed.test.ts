import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, type DB } from "@/lib/capture/db/client";
import { runMigrations } from "@/lib/capture/db/migrate";
import { loadSeedFromFile } from "@/lib/mechanism/loader";
import { loadGraph, getGraph, getChannel } from "@/lib/mechanism/graph";

// The real config/mechanism-graph.yaml must validate (shape, referential
// integrity, regime keys, non-advisory guardrail) and load cleanly.

describe("config/mechanism-graph.yaml (graph-v1)", () => {
  it("validates and encodes the spec-named channels", () => {
    const { seed } = loadSeedFromFile();
    expect(seed.version).toBe("graph-v1");
    const channels = new Set(seed.edges.map((e) => e.channel));
    for (const c of ["basis_arb", "dollar_liquidity", "macro_risk", "liquidity_risk"]) expect(channels).toContain(c);
    // basis_arb is a two-way relationship expressed as directed pairs
    expect(seed.edges.filter((e) => e.channel === "basis_arb").length).toBeGreaterThanOrEqual(4);
    // every factor node maps to a known corpus stream
    for (const n of seed.nodes.filter((x) => x.kind === "factor")) expect(n.factor_stream).toBeTruthy();
  });

  let db: DB;
  beforeEach(() => {
    db = openDb(":memory:");
    runMigrations(db);
  });
  afterEach(() => db.close());

  it("loads into the DB and is retrievable point-in-time", () => {
    const out = loadGraph(db, loadSeedFromFile(), 1000);
    expect(out.action).toBe("loaded");
    const g = getGraph(db, { asOf: 2000 })!;
    expect(g.version).toBe("graph-v1");
    expect(g.nodes.length).toBeGreaterThanOrEqual(10);
    expect(getChannel(db, "dollar_liquidity")).toHaveLength(1);
    // dxy->risk_appetite carries a dollar_regime condition
    const dxy = g.edges.find((e) => e.id === "dxy_to_risk_appetite")!;
    expect(dxy.regimes_applies).toContain("dollar_regime:strong");
    expect(dxy.polarity).toBe("negative");
  });
});
