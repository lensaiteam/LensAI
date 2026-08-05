-- Phase 6 twin: emitted briefs (calibration record). Append-only (reuses the
-- corpus reject_mutation() trigger fn). Not exercised in SQLite runs.

CREATE TABLE IF NOT EXISTS briefs (
  id             BIGSERIAL PRIMARY KEY,
  surface        TEXT    NOT NULL,
  asset          TEXT,
  as_of          BIGINT  NOT NULL,
  text           TEXT    NOT NULL,
  claims_kept    INTEGER NOT NULL,
  claims_dropped INTEGER NOT NULL,
  input_refs     JSONB   NOT NULL,
  audit          JSONB   NOT NULL,
  provider       TEXT    NOT NULL,
  code_version   TEXT    NOT NULL,
  created_at     BIGINT  NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_briefs_surface ON briefs (surface, as_of);
CREATE INDEX IF NOT EXISTS idx_briefs_asset ON briefs (asset, as_of);

DROP TRIGGER IF EXISTS briefs_no_mutate ON briefs;
CREATE TRIGGER briefs_no_mutate BEFORE UPDATE OR DELETE ON briefs
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();
