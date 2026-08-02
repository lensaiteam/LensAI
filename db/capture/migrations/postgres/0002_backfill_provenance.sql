-- Phase 2 twin: provenance for backfilled observations (see the sqlite dialect
-- for rationale). Not exercised in Phase 1/2 SQLite runs; kept for the lift.
ALTER TABLE factor_observations ADD COLUMN IF NOT EXISTS is_backfill BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_obs_backfill ON factor_observations (is_backfill);
