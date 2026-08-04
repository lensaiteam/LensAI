import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, type DB } from "@/lib/capture/db/client";
import { runMigrations } from "@/lib/capture/db/migrate";
import { loadSeedFromText } from "@/lib/mechanism/loader";
import { loadGraph, getGraph, getEdgesForNode, getChannel, resolveVersion } from "@/lib/mechanism/graph";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  runMigrations(db);
});
afterEach(() => db.close());

const seedText = (version: string, polarity = "positive") => `
version: ${version}
curator: test
nodes:
  - { id: stablecoin_float, label: "Stablecoin float", kind: factor, factor_stream: stablecoin_float }
  - { id: spot_buying_power, label: "Spot buying power", kind: concept }
  - { id: dead_node, label: "Retired", kind: concept, deprecated: true }
edges:
  - id: sf_to_sbp
    src: stablecoin_float
    dst: spot_buying_power
    polarity: ${polarity}
    channel: dollar_liquidity
    mechanism: "Net new issuance expands dry powder available to bid spot."
    regimes_applies: [dollar_regime]
    lifecycle: documented
    strength: moderate
`;

describe("migration 0004 + append-only", () => {
  it("creates the graph tables and records the migration", () => {
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map((t) => t.name);
    for (const t of ["mechanism_nodes", "mechanism_edges", "mechanism_evidence", "mechanism_graph_versions"]) expect(tables).toContain(t);
    const v = (db.prepare("SELECT version FROM schema_migrations").all() as { version: string }[]).map((r) => r.version);
    expect(v).toContain("0004_mechanism_graph");
  });

  it("rejects UPDATE and DELETE on graph tables (append-only)", () => {
    loadGraph(db, loadSeedFromText(seedText("v1")), 1000);
    expect(() => db.prepare("UPDATE mechanism_nodes SET label='x'").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM mechanism_edges").run()).toThrow(/append-only/);
    expect(() => db.prepare("DELETE FROM mechanism_graph_versions").run()).toThrow(/append-only/);
  });
});

describe("loadGraph versioning decisions", () => {
  it("loads a version, then no-ops on identical reload", () => {
    const loaded = loadSeedFromText(seedText("v1"));
    expect(loadGraph(db, loaded, 1000).action).toBe("loaded");
    expect(loadGraph(db, loaded, 2000).action).toBe("noop_same_version");
    // still one version row
    expect((db.prepare("SELECT count(*) c FROM mechanism_graph_versions").get() as { c: number }).c).toBe(1);
  });

  it("hard-errors on same version id with different checksum", () => {
    loadGraph(db, loadSeedFromText(seedText("v1", "positive")), 1000);
    expect(() => loadGraph(db, loadSeedFromText(seedText("v1", "negative")), 2000)).toThrow(/different checksum/);
  });

  it("no-ops with warning on same content under a new version id", () => {
    loadGraph(db, loadSeedFromText(seedText("v1")), 1000);
    const out = loadGraph(db, loadSeedFromText(seedText("v1b")), 2000); // identical content, new id
    expect(out).toMatchObject({ action: "noop_same_content", existingVersion: "v1" });
  });
});

describe("getGraph point-in-time (DoD)", () => {
  it("resolves the version in effect at asOf across two loaded versions", () => {
    loadGraph(db, loadSeedFromText(seedText("v1", "positive")), 1000);
    loadGraph(db, loadSeedFromText(seedText("v2", "negative")), 2000); // different content + id

    expect(resolveVersion(db, 1500)).toBe("v1");
    expect(resolveVersion(db, 2500)).toBe("v2");
    expect(resolveVersion(db)).toBe("v2"); // latest

    expect(getGraph(db, { asOf: 1500 })!.edges[0].polarity).toBe("positive");
    expect(getGraph(db, { asOf: 2500 })!.edges[0].polarity).toBe("negative");
    expect(getGraph(db, { asOf: 500 })).toBeNull(); // before any load
  });

  it("excludes deprecated nodes by default; includes with the flag", () => {
    loadGraph(db, loadSeedFromText(seedText("v1")), 1000);
    const g = getGraph(db, {})!;
    expect(g.nodes.map((n) => n.id)).not.toContain("dead_node");
    expect(getGraph(db, { includeDeprecated: true })!.nodes.map((n) => n.id)).toContain("dead_node");
  });

  it("parses regime arrays and supports node/channel lookups", () => {
    loadGraph(db, loadSeedFromText(seedText("v1")), 1000);
    expect(getGraph(db, {})!.edges[0].regimes_applies).toEqual(["dollar_regime"]);
    expect(getEdgesForNode(db, "stablecoin_float").map((e) => e.id)).toEqual(["sf_to_sbp"]);
    expect(getChannel(db, "dollar_liquidity")).toHaveLength(1);
    expect(getChannel(db, "nope")).toHaveLength(0);
  });
});
