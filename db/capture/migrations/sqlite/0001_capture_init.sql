-- LensAI v2 capture corpus — SQLite dialect (Phase 1).
-- Invariants (CLAUDE.md): append-only, content-hashed, two separate timestamps,
-- corrections/revisions are NEW rows. Immutability is enforced by triggers below;
-- point-in-time is enforced in the DAL (captured_at <= as_of).
--
-- Timestamps are epoch MILLISECONDS (INTEGER), timezone-free and portable to the
-- Postgres twin (db/capture/migrations/postgres/0001_capture_init.sql).
-- `captured_at` = true server clock at ingest. The source's own time is ALWAYS a
-- separate column (`published_at` for articles, `observed_at` for observations);
-- for polled streams `observed_at` is the floored schedule-slot boundary.

-- ── Immutable corpus: articles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  source        TEXT    NOT NULL,                 -- config source id, e.g. "coindesk"
  url           TEXT    NOT NULL,
  guid          TEXT,                             -- feed guid if present
  title         TEXT,
  author        TEXT,
  published_at  INTEGER,                          -- source publish time (ms), nullable
  captured_at   INTEGER NOT NULL
                DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  content_hash  TEXT    NOT NULL,                 -- sha256 of normalized extracted_text
  raw_html      TEXT,
  extracted_text TEXT   NOT NULL,
  lang          TEXT,
  -- Per-source dedupe (OPEN_QUESTIONS Q2): cross-source syndication is kept;
  -- re-fetching the same item from the same source dedupes.
  UNIQUE (source, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_articles_source_captured ON articles (source, captured_at);
CREATE INDEX IF NOT EXISTS idx_articles_captured        ON articles (captured_at);
CREATE INDEX IF NOT EXISTS idx_articles_published       ON articles (published_at);

-- ── Immutable corpus: factor observations ───────────────────────────────────
CREATE TABLE IF NOT EXISTS factor_observations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  stream        TEXT    NOT NULL,                 -- funding_rate | open_interest | spot_price | ...
  source        TEXT    NOT NULL,                 -- binance | bybit | coingecko | defillama | fred
  asset         TEXT    NOT NULL,                 -- BTC | ETH | DXY | DGS10 | TOTAL-STABLE ...
  instrument    TEXT    NOT NULL DEFAULT '',      -- e.g. "BTCUSDT"; '' (never NULL) so UNIQUE dedupes
  value         REAL,                             -- nullable (e.g. depth carries its numbers in metadata)
  unit          TEXT,
  observed_at   INTEGER NOT NULL,                 -- source time OR floored slot boundary (ms)
  captured_at   INTEGER NOT NULL
                DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  metadata      TEXT,                             -- JSON string; nullable
  content_hash  TEXT    NOT NULL,                 -- sha256 of the canonical observation payload
  -- content_hash is in the key ON PURPOSE (OPEN_QUESTIONS Q3): a revised value for
  -- the same observed_at (e.g. FRED) has a new hash and APPENDS; an identical
  -- re-fetch has the same hash and dedupes (restart idempotency).
  UNIQUE (stream, source, asset, instrument, observed_at, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_obs_asset_captured        ON factor_observations (asset, captured_at);
CREATE INDEX IF NOT EXISTS idx_obs_stream_asset_captured ON factor_observations (stream, asset, captured_at);
CREATE INDEX IF NOT EXISTS idx_obs_slot                  ON factor_observations (stream, source, asset, instrument, observed_at);

-- ── Immutable corpus: typed claims (schema only in Phase 1) ─────────────────
CREATE TABLE IF NOT EXISTS claims (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id          INTEGER REFERENCES articles(id),
  claimant            TEXT    NOT NULL,
  claimant_incentive  TEXT,
  claimed_at          INTEGER,
  claim_text          TEXT    NOT NULL,
  mechanism_refs      TEXT,                       -- JSON array of mechanism-graph node ids
  content_hash        TEXT    NOT NULL,
  captured_at         INTEGER NOT NULL
                      DEFAULT (CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)),
  UNIQUE (content_hash)
);
CREATE INDEX IF NOT EXISTS idx_claims_article  ON claims (article_id);
CREATE INDEX IF NOT EXISTS idx_claims_captured ON claims (captured_at);

-- ── Immutability triggers (INVARIANT 1): reject UPDATE and DELETE ───────────
-- Corrections are new rows, never in-place edits. Applies to the corpus tables
-- only; ingest_runs / schema_migrations are operational and remain mutable.
CREATE TRIGGER IF NOT EXISTS articles_no_update BEFORE UPDATE ON articles
  BEGIN SELECT RAISE(ABORT, 'articles is append-only (immutable capture)'); END;
CREATE TRIGGER IF NOT EXISTS articles_no_delete BEFORE DELETE ON articles
  BEGIN SELECT RAISE(ABORT, 'articles is append-only (immutable capture)'); END;

CREATE TRIGGER IF NOT EXISTS obs_no_update BEFORE UPDATE ON factor_observations
  BEGIN SELECT RAISE(ABORT, 'factor_observations is append-only (immutable capture)'); END;
CREATE TRIGGER IF NOT EXISTS obs_no_delete BEFORE DELETE ON factor_observations
  BEGIN SELECT RAISE(ABORT, 'factor_observations is append-only (immutable capture)'); END;

CREATE TRIGGER IF NOT EXISTS claims_no_update BEFORE UPDATE ON claims
  BEGIN SELECT RAISE(ABORT, 'claims is append-only (immutable capture)'); END;
CREATE TRIGGER IF NOT EXISTS claims_no_delete BEFORE DELETE ON claims
  BEGIN SELECT RAISE(ABORT, 'claims is append-only (immutable capture)'); END;

-- ── Operational (MUTABLE): scheduler bookkeeping + visibility of gaps ───────
CREATE TABLE IF NOT EXISTS ingest_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  job           TEXT    NOT NULL,                 -- e.g. "rss:coindesk", "factor:binance_funding"
  source        TEXT,                             -- source id, for last-success-per-source view
  slot          INTEGER,                          -- scheduled slot boundary (ms), nullable
  started_at    INTEGER NOT NULL,
  finished_at   INTEGER,
  status        TEXT    NOT NULL DEFAULT 'running', -- running | ok | error | partial | skipped
  rows_written  INTEGER NOT NULL DEFAULT 0,
  rows_deduped  INTEGER NOT NULL DEFAULT 0,
  error         TEXT
);
CREATE INDEX IF NOT EXISTS idx_ingest_job_started    ON ingest_runs (job, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingest_source_started ON ingest_runs (source, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingest_job_slot       ON ingest_runs (job, slot);
