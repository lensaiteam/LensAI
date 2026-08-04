import type { DB } from "../capture/db/client";
import type { LoadedSeed } from "./loader";

/**
 * DB layer for the mechanism graph. Loads are transactional and append-only:
 * rows for a (id, graph_version) are inserted once and never mutated. Versioning
 * rulings (amendment #2/#6):
 *   - version already loaded, same checksum      -> no-op (idempotent)
 *   - version already loaded, different checksum -> hard error (bump the version)
 *   - same content checksum under a new version  -> no-op + warning
 * Reads are point-in-time: getGraph({asOf}) resolves the latest version whose
 * loaded_at <= asOf.
 */

export interface GraphNodeRow {
  id: string;
  graph_version: string;
  label: string;
  kind: string;
  factor_stream: string | null;
  description: string | null;
  deprecated: number;
  curator: string | null;
  curated_at: number;
  metadata: Record<string, unknown> | null;
}

export interface GraphEdgeRow {
  id: string;
  graph_version: string;
  src: string;
  dst: string;
  polarity: string;
  channel: string | null;
  mechanism: string;
  conditions: string | null;
  regimes_applies: string[] | null;
  regimes_breaks: string[] | null;
  lifecycle: string;
  strength: string | null;
  deprecated: number;
  curator: string | null;
  curated_at: number;
}

export interface ResolvedGraph {
  version: string;
  nodes: GraphNodeRow[];
  edges: GraphEdgeRow[];
}

export type LoadOutcome =
  | { action: "loaded"; version: string; checksum: string; nodes: number; edges: number }
  | { action: "noop_same_version"; version: string }
  | { action: "noop_same_content"; version: string; existingVersion: string };

export function loadGraph(db: DB, loaded: LoadedSeed, loadedAt: number = Date.now()): LoadOutcome {
  const { seed, checksum } = loaded;

  const existing = db.prepare("SELECT checksum FROM mechanism_graph_versions WHERE version = ?").get(seed.version) as { checksum: string } | undefined;
  if (existing) {
    if (existing.checksum === checksum) return { action: "noop_same_version", version: seed.version };
    throw new Error(`mechanism graph version "${seed.version}" already loaded with a different checksum — bump the version (append-only).`);
  }
  const sameContent = db.prepare("SELECT version FROM mechanism_graph_versions WHERE checksum = ? LIMIT 1").get(checksum) as { version: string } | undefined;
  if (sameContent) {
    return { action: "noop_same_content", version: seed.version, existingVersion: sameContent.version };
  }

  const insNode = db.prepare(`INSERT INTO mechanism_nodes
    (id, graph_version, label, kind, factor_stream, description, deprecated, curator, curated_at, metadata)
    VALUES (@id, @gv, @label, @kind, @factor_stream, @description, @deprecated, @curator, @curated_at, @metadata)`);
  const insEdge = db.prepare(`INSERT INTO mechanism_edges
    (id, graph_version, src, dst, polarity, channel, mechanism, conditions, regimes_applies, regimes_breaks, lifecycle, strength, deprecated, curator, curated_at)
    VALUES (@id, @gv, @src, @dst, @polarity, @channel, @mechanism, @conditions, @regimes_applies, @regimes_breaks, @lifecycle, @strength, @deprecated, @curator, @curated_at)`);
  const insEv = db.prepare(`INSERT INTO mechanism_evidence
    (edge_id, graph_version, ref_type, ref_value, note, curated_at)
    VALUES (@edge_id, @gv, @ref_type, @ref_value, @note, @curated_at)`);
  const insVer = db.prepare(`INSERT INTO mechanism_graph_versions
    (version, checksum, loaded_at, curator, note, node_count, edge_count)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);

  const gv = seed.version;
  const tx = db.transaction(() => {
    for (const n of seed.nodes) {
      insNode.run({ id: n.id, gv, label: n.label, kind: n.kind, factor_stream: n.factor_stream ?? null, description: n.description ?? null, deprecated: n.deprecated ? 1 : 0, curator: seed.curator, curated_at: loadedAt, metadata: n.metadata ? JSON.stringify(n.metadata) : null });
    }
    for (const e of seed.edges) {
      insEdge.run({
        id: e.id, gv, src: e.src, dst: e.dst, polarity: e.polarity, channel: e.channel ?? null,
        mechanism: e.mechanism, conditions: e.conditions ?? null,
        regimes_applies: e.regimes_applies ? JSON.stringify(e.regimes_applies) : null,
        regimes_breaks: e.regimes_breaks ? JSON.stringify(e.regimes_breaks) : null,
        lifecycle: e.lifecycle, strength: e.strength ?? null, deprecated: e.deprecated ? 1 : 0,
        curator: seed.curator, curated_at: loadedAt,
      });
      for (const ev of e.evidence ?? []) {
        insEv.run({ edge_id: e.id, gv, ref_type: ev.type, ref_value: ev.ref, note: ev.note ?? null, curated_at: loadedAt });
      }
    }
    insVer.run(gv, checksum, loadedAt, seed.curator, seed.note ?? null, seed.nodes.length, seed.edges.length);
  });
  tx();
  return { action: "loaded", version: gv, checksum, nodes: seed.nodes.length, edges: seed.edges.length };
}

/** The graph version in effect at `asOf` (latest loaded_at <= asOf); latest if omitted. */
export function resolveVersion(db: DB, asOf?: number): string | null {
  const row = (asOf === undefined
    ? db.prepare("SELECT version FROM mechanism_graph_versions ORDER BY loaded_at DESC, version DESC LIMIT 1").get()
    : db.prepare("SELECT version FROM mechanism_graph_versions WHERE loaded_at <= ? ORDER BY loaded_at DESC, version DESC LIMIT 1").get(asOf)) as { version: string } | undefined;
  return row ? row.version : null;
}

function parseEdge(r: Omit<GraphEdgeRow, "regimes_applies" | "regimes_breaks"> & { regimes_applies: string | null; regimes_breaks: string | null }): GraphEdgeRow {
  return {
    ...r,
    regimes_applies: r.regimes_applies ? (JSON.parse(r.regimes_applies) as string[]) : null,
    regimes_breaks: r.regimes_breaks ? (JSON.parse(r.regimes_breaks) as string[]) : null,
  };
}

export interface GraphReadOpts {
  asOf?: number;
  includeDeprecated?: boolean;
}

/** Point-in-time graph: nodes + edges of the version in effect at asOf. */
export function getGraph(db: DB, opts: GraphReadOpts = {}): ResolvedGraph | null {
  const version = resolveVersion(db, opts.asOf);
  if (!version) return null;
  const dep = opts.includeDeprecated ? "" : " AND deprecated = 0";
  const nodesRaw = db.prepare(`SELECT * FROM mechanism_nodes WHERE graph_version = ?${dep} ORDER BY id`).all(version) as (Omit<GraphNodeRow, "metadata"> & { metadata: string | null })[];
  const nodes = nodesRaw.map((n) => ({ ...n, metadata: n.metadata ? (JSON.parse(n.metadata) as Record<string, unknown>) : null }));
  const edgesRaw = db.prepare(`SELECT * FROM mechanism_edges WHERE graph_version = ?${dep} ORDER BY id`).all(version) as Parameters<typeof parseEdge>[0][];
  return { version, nodes, edges: edgesRaw.map(parseEdge) };
}

/** Edges touching a node (as src or dst) in the point-in-time graph. */
export function getEdgesForNode(db: DB, nodeId: string, opts: GraphReadOpts = {}): GraphEdgeRow[] {
  const g = getGraph(db, opts);
  if (!g) return [];
  return g.edges.filter((e) => e.src === nodeId || e.dst === nodeId);
}

/** Edges in a named channel in the point-in-time graph. */
export function getChannel(db: DB, channel: string, opts: GraphReadOpts = {}): GraphEdgeRow[] {
  const g = getGraph(db, opts);
  if (!g) return [];
  return g.edges.filter((e) => e.channel === channel);
}
