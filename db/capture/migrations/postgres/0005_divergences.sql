-- Phase 4 twin: divergence flags (see sqlite dialect). Derived, not corpus.

CREATE TABLE IF NOT EXISTS factor_divergences (
  id            BIGSERIAL PRIMARY KEY,
  kind          TEXT    NOT NULL,
  subject       TEXT    NOT NULL,
  window_id     TEXT    NOT NULL DEFAULT '',
  slot          BIGINT  NOT NULL,
  as_of         BIGINT  NOT NULL,
  fired         BOOLEAN NOT NULL,
  magnitude     DOUBLE PRECISION,
  status        TEXT    NOT NULL,
  vintage       TEXT    NOT NULL,
  detail        JSONB   NOT NULL,
  code_version  TEXT    NOT NULL,
  params        JSONB   NOT NULL,
  computed_at   BIGINT  NOT NULL,
  UNIQUE (kind, subject, window_id, slot, as_of, code_version)
);
CREATE INDEX IF NOT EXISTS idx_div_kind_slot ON factor_divergences (kind, slot);
CREATE INDEX IF NOT EXISTS idx_div_asof ON factor_divergences (as_of);
CREATE INDEX IF NOT EXISTS idx_div_fired ON factor_divergences (fired);
