-- Phase 2 twin: derived factor-state tables (see sqlite dialect for rationale).
-- Rebuildable, not corpus, no immutability triggers. Not exercised in SQLite runs.

CREATE TABLE IF NOT EXISTS factor_percentiles (
  id            BIGSERIAL PRIMARY KEY,
  stream        TEXT   NOT NULL,
  source        TEXT   NOT NULL,
  asset         TEXT   NOT NULL,
  instrument    TEXT   NOT NULL DEFAULT '',
  slot          BIGINT NOT NULL,
  window_id     TEXT   NOT NULL,
  status        TEXT   NOT NULL,
  value         DOUBLE PRECISION,
  percentile    DOUBLE PRECISION,
  n_obs         INTEGER NOT NULL,
  vintage       TEXT   NOT NULL,
  staleness_ms  BIGINT,
  as_of         BIGINT NOT NULL,
  code_version  TEXT   NOT NULL,
  params        JSONB  NOT NULL,
  computed_at   BIGINT NOT NULL,
  UNIQUE (stream, source, asset, instrument, slot, window_id, as_of, code_version)
);
CREATE INDEX IF NOT EXISTS idx_pctl_slot ON factor_percentiles (stream, asset, slot);
CREATE INDEX IF NOT EXISTS idx_pctl_asof ON factor_percentiles (as_of);

CREATE TABLE IF NOT EXISTS factor_regimes (
  id            BIGSERIAL PRIMARY KEY,
  regime_key    TEXT   NOT NULL,
  asset         TEXT   NOT NULL DEFAULT '',
  slot          BIGINT NOT NULL,
  regime_value  TEXT   NOT NULL,
  as_of         BIGINT NOT NULL,
  rule_version  TEXT   NOT NULL,
  params        JSONB  NOT NULL,
  computed_at   BIGINT NOT NULL,
  UNIQUE (regime_key, asset, slot, as_of, rule_version)
);
CREATE INDEX IF NOT EXISTS idx_regime_slot ON factor_regimes (regime_key, asset, slot);
