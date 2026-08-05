-- Phase 6: emitted briefs — the CALIBRATION RECORD (spec §08), a moat asset.
-- Append-only: a brief, once emitted at an as_of, is an immutable record of what
-- the desk said and on what evidence, so later scoring against forward outcomes is
-- honest. Same immutability discipline as the corpus (corrections are new rows).

CREATE TABLE IF NOT EXISTS briefs (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  surface        TEXT    NOT NULL,          -- market | token
  asset          TEXT,                      -- null for market
  as_of          INTEGER NOT NULL,          -- anchor the brief was written against
  text           TEXT    NOT NULL,          -- rendered brief
  claims_kept    INTEGER NOT NULL,
  claims_dropped INTEGER NOT NULL,
  input_refs     TEXT    NOT NULL,          -- JSON: store refs the surviving claims cite
  audit          TEXT    NOT NULL,          -- JSON: full claim audit (kept/dropped + reasons)
  provider       TEXT    NOT NULL,
  code_version   TEXT    NOT NULL,
  created_at     INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_briefs_surface ON briefs (surface, as_of);
CREATE INDEX IF NOT EXISTS idx_briefs_asset ON briefs (asset, as_of);

CREATE TRIGGER IF NOT EXISTS briefs_no_update BEFORE UPDATE ON briefs
  BEGIN SELECT RAISE(ABORT, 'briefs is append-only (calibration record)'); END;
CREATE TRIGGER IF NOT EXISTS briefs_no_delete BEFORE DELETE ON briefs
  BEGIN SELECT RAISE(ABORT, 'briefs is append-only (calibration record)'); END;
