-- Phase 3: mechanism graph — hand-curated, versioned, point-in-time.
--
-- "Curated" means the SEED FILE is editable; the DB rows are NOT. Every table here
-- is append-only under the same immutability discipline as the corpus: rows for a
-- given (id, graph_version) never mutate — a change is a NEW graph_version. This
-- keeps every past Market State read reproducible against the graph as it stood.
-- Loads are transactional (all-or-nothing) in the loader.

CREATE TABLE IF NOT EXISTS mechanism_graph_versions (
  version      TEXT PRIMARY KEY,
  checksum     TEXT    NOT NULL,          -- sha256 of the normalized seed
  loaded_at    INTEGER NOT NULL,          -- point-in-time anchor for getGraph({asOf})
  curator      TEXT,
  note         TEXT,
  node_count   INTEGER NOT NULL,
  edge_count   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_graphver_loaded ON mechanism_graph_versions (loaded_at);

CREATE TABLE IF NOT EXISTS mechanism_nodes (
  id            TEXT    NOT NULL,          -- permanent slug (renames = add + deprecate)
  graph_version TEXT    NOT NULL,
  label         TEXT    NOT NULL,
  kind          TEXT    NOT NULL,          -- factor | concept | instrument | entity
  factor_stream TEXT,                      -- if kind=factor, the corpus stream it maps to
  description   TEXT,
  deprecated    INTEGER NOT NULL DEFAULT 0,
  curator       TEXT,
  curated_at    INTEGER NOT NULL,
  metadata      TEXT,                      -- JSON
  PRIMARY KEY (id, graph_version)
);
CREATE INDEX IF NOT EXISTS idx_node_version ON mechanism_nodes (graph_version);

CREATE TABLE IF NOT EXISTS mechanism_edges (
  id              TEXT    NOT NULL,        -- permanent slug
  graph_version   TEXT    NOT NULL,
  src             TEXT    NOT NULL,        -- node id (same graph_version; enforced in loader)
  dst             TEXT    NOT NULL,        -- node id; edges are DIRECTED only (a <-> is two edges)
  polarity        TEXT    NOT NULL,        -- positive | negative | conditional
  channel         TEXT,                    -- groups related edges (e.g. basis_arb)
  mechanism       TEXT    NOT NULL,        -- documented transmission rationale (prose)
  conditions      TEXT,                    -- prose caveats
  regimes_applies TEXT,                    -- JSON array of regime keys (validated in loader)
  regimes_breaks  TEXT,                    -- JSON array of regime keys
  lifecycle       TEXT    NOT NULL,        -- documented | validated | decaying | broken
  strength        TEXT,                    -- curated PRIOR: strong|moderate|weak (label as such)
  deprecated      INTEGER NOT NULL DEFAULT 0,
  curator         TEXT,
  curated_at      INTEGER NOT NULL,
  PRIMARY KEY (id, graph_version)
);
CREATE INDEX IF NOT EXISTS idx_edge_version ON mechanism_edges (graph_version);
CREATE INDEX IF NOT EXISTS idx_edge_channel ON mechanism_edges (channel);
CREATE INDEX IF NOT EXISTS idx_edge_src ON mechanism_edges (src, graph_version);
CREATE INDEX IF NOT EXISTS idx_edge_dst ON mechanism_edges (dst, graph_version);

CREATE TABLE IF NOT EXISTS mechanism_evidence (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  edge_id       TEXT    NOT NULL,
  graph_version TEXT    NOT NULL,
  ref_type      TEXT    NOT NULL,          -- article | claim | external
  ref_value     TEXT    NOT NULL,          -- article content_hash | claim id | URL
  note          TEXT,
  curated_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_edge ON mechanism_evidence (edge_id, graph_version);

-- ── Immutability triggers (amendment #2): all graph tables are append-only ────
CREATE TRIGGER IF NOT EXISTS graphver_no_update BEFORE UPDATE ON mechanism_graph_versions
  BEGIN SELECT RAISE(ABORT, 'mechanism_graph_versions is append-only (bump graph_version)'); END;
CREATE TRIGGER IF NOT EXISTS graphver_no_delete BEFORE DELETE ON mechanism_graph_versions
  BEGIN SELECT RAISE(ABORT, 'mechanism_graph_versions is append-only (bump graph_version)'); END;

CREATE TRIGGER IF NOT EXISTS mnodes_no_update BEFORE UPDATE ON mechanism_nodes
  BEGIN SELECT RAISE(ABORT, 'mechanism_nodes is append-only (bump graph_version)'); END;
CREATE TRIGGER IF NOT EXISTS mnodes_no_delete BEFORE DELETE ON mechanism_nodes
  BEGIN SELECT RAISE(ABORT, 'mechanism_nodes is append-only (bump graph_version)'); END;

CREATE TRIGGER IF NOT EXISTS medges_no_update BEFORE UPDATE ON mechanism_edges
  BEGIN SELECT RAISE(ABORT, 'mechanism_edges is append-only (bump graph_version)'); END;
CREATE TRIGGER IF NOT EXISTS medges_no_delete BEFORE DELETE ON mechanism_edges
  BEGIN SELECT RAISE(ABORT, 'mechanism_edges is append-only (bump graph_version)'); END;

CREATE TRIGGER IF NOT EXISTS mevidence_no_update BEFORE UPDATE ON mechanism_evidence
  BEGIN SELECT RAISE(ABORT, 'mechanism_evidence is append-only (bump graph_version)'); END;
CREATE TRIGGER IF NOT EXISTS mevidence_no_delete BEFORE DELETE ON mechanism_evidence
  BEGIN SELECT RAISE(ABORT, 'mechanism_evidence is append-only (bump graph_version)'); END;
