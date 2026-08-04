-- Phase 4: divergence flags — DERIVED (rebuildable), not corpus. Like the factor
-- state tables: exempt from immutability triggers, but every row stamps
-- code_version + params + point-in-time provenance (as_of, vintage). Recompute is
-- idempotent via the unique key + INSERT OR REPLACE in the divergence DAL.

CREATE TABLE IF NOT EXISTS factor_divergences (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT    NOT NULL,          -- extreme_state | broken_relationship | structural_signature
  subject       TEXT    NOT NULL,          -- "stream/source/asset" | edge id | signature key
  window_id     TEXT    NOT NULL DEFAULT '',
  slot          INTEGER NOT NULL,
  as_of         INTEGER NOT NULL,
  fired         INTEGER NOT NULL,          -- 0/1
  magnitude     REAL,                      -- arithmetic strength (nullable)
  status        TEXT    NOT NULL,          -- ok | indeterminate
  vintage       TEXT    NOT NULL,          -- true_pit | current_vintage
  detail        TEXT    NOT NULL,          -- JSON: inputs, thresholds, refs
  code_version  TEXT    NOT NULL,
  params        TEXT    NOT NULL,
  computed_at   INTEGER NOT NULL,
  UNIQUE (kind, subject, window_id, slot, as_of, code_version)
);
CREATE INDEX IF NOT EXISTS idx_div_kind_slot ON factor_divergences (kind, slot);
CREATE INDEX IF NOT EXISTS idx_div_asof ON factor_divergences (as_of);
CREATE INDEX IF NOT EXISTS idx_div_fired ON factor_divergences (fired);
