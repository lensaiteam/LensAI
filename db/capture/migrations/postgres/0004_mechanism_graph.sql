-- Phase 3 twin: mechanism graph (see sqlite dialect for rationale). Append-only
-- graph tables reuse the corpus reject_mutation() trigger fn. Not exercised in
-- SQLite runs; kept for the lift.

CREATE TABLE IF NOT EXISTS mechanism_graph_versions (
  version      TEXT PRIMARY KEY,
  checksum     TEXT    NOT NULL,
  loaded_at    BIGINT  NOT NULL,
  curator      TEXT,
  note         TEXT,
  node_count   INTEGER NOT NULL,
  edge_count   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_graphver_loaded ON mechanism_graph_versions (loaded_at);

CREATE TABLE IF NOT EXISTS mechanism_nodes (
  id            TEXT    NOT NULL,
  graph_version TEXT    NOT NULL,
  label         TEXT    NOT NULL,
  kind          TEXT    NOT NULL,
  factor_stream TEXT,
  description   TEXT,
  deprecated    BOOLEAN NOT NULL DEFAULT false,
  curator       TEXT,
  curated_at    BIGINT  NOT NULL,
  metadata      JSONB,
  PRIMARY KEY (id, graph_version)
);
CREATE INDEX IF NOT EXISTS idx_node_version ON mechanism_nodes (graph_version);

CREATE TABLE IF NOT EXISTS mechanism_edges (
  id              TEXT    NOT NULL,
  graph_version   TEXT    NOT NULL,
  src             TEXT    NOT NULL,
  dst             TEXT    NOT NULL,
  polarity        TEXT    NOT NULL,
  channel         TEXT,
  mechanism       TEXT    NOT NULL,
  conditions      TEXT,
  regimes_applies JSONB,
  regimes_breaks  JSONB,
  lifecycle       TEXT    NOT NULL,
  strength        TEXT,
  deprecated      BOOLEAN NOT NULL DEFAULT false,
  curator         TEXT,
  curated_at      BIGINT  NOT NULL,
  PRIMARY KEY (id, graph_version)
);
CREATE INDEX IF NOT EXISTS idx_edge_version ON mechanism_edges (graph_version);
CREATE INDEX IF NOT EXISTS idx_edge_channel ON mechanism_edges (channel);
CREATE INDEX IF NOT EXISTS idx_edge_src ON mechanism_edges (src, graph_version);
CREATE INDEX IF NOT EXISTS idx_edge_dst ON mechanism_edges (dst, graph_version);

CREATE TABLE IF NOT EXISTS mechanism_evidence (
  id            BIGSERIAL PRIMARY KEY,
  edge_id       TEXT    NOT NULL,
  graph_version TEXT    NOT NULL,
  ref_type      TEXT    NOT NULL,
  ref_value     TEXT    NOT NULL,
  note          TEXT,
  curated_at    BIGINT  NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_edge ON mechanism_evidence (edge_id, graph_version);

DROP TRIGGER IF EXISTS graphver_no_mutate ON mechanism_graph_versions;
CREATE TRIGGER graphver_no_mutate BEFORE UPDATE OR DELETE ON mechanism_graph_versions
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
DROP TRIGGER IF EXISTS mnodes_no_mutate ON mechanism_nodes;
CREATE TRIGGER mnodes_no_mutate BEFORE UPDATE OR DELETE ON mechanism_nodes
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
DROP TRIGGER IF EXISTS medges_no_mutate ON mechanism_edges;
CREATE TRIGGER medges_no_mutate BEFORE UPDATE OR DELETE ON mechanism_edges
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
DROP TRIGGER IF EXISTS mevidence_no_mutate ON mechanism_evidence;
CREATE TRIGGER mevidence_no_mutate BEFORE UPDATE OR DELETE ON mechanism_evidence
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
