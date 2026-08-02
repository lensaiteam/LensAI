-- Phase 2: DERIVED factor-state tables (amendment #2).
--
-- These are rebuildable functions of the corpus, so they are NOT append-only and
-- are deliberately exempt from the immutability triggers (which cover only the
-- corpus tables). To stay reproducible, EVERY derived row records the code/rule
-- version and params that produced it, plus its point-in-time provenance
-- (as_of run anchor, vintage, staleness). Recompute is idempotent via the unique
-- key + INSERT OR REPLACE in the derived DAL.

CREATE TABLE IF NOT EXISTS factor_percentiles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  stream        TEXT    NOT NULL,
  source        TEXT    NOT NULL,
  asset         TEXT    NOT NULL,
  instrument    TEXT    NOT NULL DEFAULT '',
  slot          INTEGER NOT NULL,             -- canonical grid slot T (observed_at clock)
  window_id     TEXT    NOT NULL,             -- 90d | 365d | full
  status        TEXT    NOT NULL,             -- ok | insufficient_history
  value         REAL,                         -- state value at T (null if no data)
  percentile    REAL,                         -- 0..1; null when insufficient_history
  n_obs         INTEGER NOT NULL,
  vintage       TEXT    NOT NULL,             -- true_pit | current_vintage
  staleness_ms  INTEGER,                      -- T - state.observed_at
  as_of         INTEGER NOT NULL,             -- run anchor (the captured_at gate used)
  code_version  TEXT    NOT NULL,
  params        TEXT    NOT NULL,             -- JSON: {window_id, lookbackMs, minObs, method}
  computed_at   INTEGER NOT NULL,
  UNIQUE (stream, source, asset, instrument, slot, window_id, as_of, code_version)
);
CREATE INDEX IF NOT EXISTS idx_pctl_slot ON factor_percentiles (stream, asset, slot);
CREATE INDEX IF NOT EXISTS idx_pctl_asof ON factor_percentiles (as_of);

CREATE TABLE IF NOT EXISTS factor_regimes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  regime_key    TEXT    NOT NULL,             -- funding_regime | dollar_regime | ...
  asset         TEXT    NOT NULL DEFAULT '',  -- '' = market-wide
  slot          INTEGER NOT NULL,
  regime_value  TEXT    NOT NULL,             -- elevated | neutral | suppressed | ...
  as_of         INTEGER NOT NULL,
  rule_version  TEXT    NOT NULL,
  params        TEXT    NOT NULL,             -- JSON: thresholds / inputs
  computed_at   INTEGER NOT NULL,
  UNIQUE (regime_key, asset, slot, as_of, rule_version)
);
CREATE INDEX IF NOT EXISTS idx_regime_slot ON factor_regimes (regime_key, asset, slot);
