-- Phase 2: provenance for backfilled observations.
--
-- Backfill imports REAL historical data from sources that publish it (FRED full
-- series, Binance funding/OI history, CoinGecko historical prices). A backfilled
-- row carries is_backfill = 1 and its TRUE captured_at (= now, when we learned
-- it), while observed_at stays the historical reference time. The point-in-time
-- DAL therefore treats it correctly: it becomes visible only at/after the instant
-- we actually captured it — no lookahead is introduced by importing history.
--
-- ADD COLUMN is a schema change, not a row mutation, so the append-only triggers
-- do not fire. Existing rows default to 0 (forward-captured).
ALTER TABLE factor_observations ADD COLUMN is_backfill INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_obs_backfill ON factor_observations (is_backfill);
