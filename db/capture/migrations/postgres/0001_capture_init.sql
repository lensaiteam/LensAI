-- LensAI v2 capture corpus — Postgres dialect (TWIN of the SQLite migration).
-- NOT exercised in Phase 1 (Phase 1 runs SQLite only); this is the reference the
-- future Postgres lift applies, kept per-dialect so that lift stays clean
-- (OPEN_QUESTIONS Q1). Table/column names match the SQLite dialect EXACTLY and
-- live in the default (public) schema, so the DAL's SQL is identical on both
-- engines. Timestamps are epoch MILLISECONDS (BIGINT) to match SQLite.

-- ── Immutable corpus: articles ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS articles (
  id             BIGSERIAL PRIMARY KEY,
  source         TEXT   NOT NULL,
  url            TEXT   NOT NULL,
  guid           TEXT,
  title          TEXT,
  author         TEXT,
  published_at   BIGINT,
  captured_at    BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
  content_hash   TEXT   NOT NULL,
  raw_html       TEXT,
  extracted_text TEXT   NOT NULL,
  lang           TEXT,
  UNIQUE (source, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_articles_source_captured ON articles (source, captured_at);
CREATE INDEX IF NOT EXISTS idx_articles_captured        ON articles (captured_at);
CREATE INDEX IF NOT EXISTS idx_articles_published       ON articles (published_at);

-- ── Immutable corpus: factor observations ───────────────────────────────────
CREATE TABLE IF NOT EXISTS factor_observations (
  id            BIGSERIAL PRIMARY KEY,
  stream        TEXT   NOT NULL,
  source        TEXT   NOT NULL,
  asset         TEXT   NOT NULL,
  instrument    TEXT   NOT NULL DEFAULT '',
  value         DOUBLE PRECISION,
  unit          TEXT,
  observed_at   BIGINT NOT NULL,
  captured_at   BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
  metadata      JSONB,
  content_hash  TEXT   NOT NULL,
  UNIQUE (stream, source, asset, instrument, observed_at, content_hash)
);
CREATE INDEX IF NOT EXISTS idx_obs_asset_captured        ON factor_observations (asset, captured_at);
CREATE INDEX IF NOT EXISTS idx_obs_stream_asset_captured ON factor_observations (stream, asset, captured_at);
CREATE INDEX IF NOT EXISTS idx_obs_slot                  ON factor_observations (stream, source, asset, instrument, observed_at);

-- ── Immutable corpus: typed claims (schema only in Phase 1) ─────────────────
CREATE TABLE IF NOT EXISTS claims (
  id                 BIGSERIAL PRIMARY KEY,
  article_id         BIGINT REFERENCES articles(id),
  claimant           TEXT   NOT NULL,
  claimant_incentive TEXT,
  claimed_at         BIGINT,
  claim_text         TEXT   NOT NULL,
  mechanism_refs     JSONB,
  content_hash       TEXT   NOT NULL,
  captured_at        BIGINT NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::BIGINT,
  UNIQUE (content_hash)
);
CREATE INDEX IF NOT EXISTS idx_claims_article  ON claims (article_id);
CREATE INDEX IF NOT EXISTS idx_claims_captured ON claims (captured_at);

-- ── Immutability triggers (INVARIANT 1): plpgsql twin of the SQLite RAISE ───
CREATE OR REPLACE FUNCTION reject_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only (immutable capture)', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS articles_no_mutate ON articles;
CREATE TRIGGER articles_no_mutate BEFORE UPDATE OR DELETE ON articles
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

DROP TRIGGER IF EXISTS obs_no_mutate ON factor_observations;
CREATE TRIGGER obs_no_mutate BEFORE UPDATE OR DELETE ON factor_observations
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

DROP TRIGGER IF EXISTS claims_no_mutate ON claims;
CREATE TRIGGER claims_no_mutate BEFORE UPDATE OR DELETE ON claims
  FOR EACH ROW EXECUTE FUNCTION reject_mutation();

-- ── Operational (MUTABLE) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingest_runs (
  id            BIGSERIAL PRIMARY KEY,
  job           TEXT   NOT NULL,
  source        TEXT,
  slot          BIGINT,
  started_at    BIGINT NOT NULL,
  finished_at   BIGINT,
  status        TEXT   NOT NULL DEFAULT 'running',
  rows_written  INTEGER NOT NULL DEFAULT 0,
  rows_deduped  INTEGER NOT NULL DEFAULT 0,
  error         TEXT
);
CREATE INDEX IF NOT EXISTS idx_ingest_job_started    ON ingest_runs (job, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingest_source_started ON ingest_runs (source, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ingest_job_slot       ON ingest_runs (job, slot);
