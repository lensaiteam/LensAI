import type { DB } from "../capture/db/client";

/**
 * DAL for the DERIVED factor-state tables (percentiles, regimes). Separate from
 * the corpus DAL: these are rebuildable artifacts, so writes are idempotent
 * INSERT OR REPLACE on the natural key (recompute with the same code/rule version
 * + as_of + slot replaces; a new version coexists). Every row already carries its
 * own provenance, so reads don't need the point-in-time gate — they return
 * self-describing computed rows.
 */

export interface PercentileRow {
  stream: string;
  source: string;
  asset: string;
  instrument: string;
  slot: number;
  window_id: string;
  status: "ok" | "insufficient_history";
  value: number | null;
  percentile: number | null;
  n_obs: number;
  vintage: "true_pit" | "current_vintage";
  staleness_ms: number | null;
  as_of: number;
  code_version: string;
  params: Record<string, unknown>;
  computed_at: number;
}

export interface RegimeRow {
  regime_key: string;
  asset: string;
  slot: number;
  regime_value: string;
  as_of: number;
  rule_version: string;
  params: Record<string, unknown>;
  computed_at: number;
}

export interface PercentileQuery {
  stream?: string;
  asset?: string;
  slot?: number;
  window_id?: string;
  as_of?: number;
}

export interface DerivedDal {
  upsertPercentile(row: PercentileRow): void;
  getPercentiles(q: PercentileQuery): PercentileRow[];
  upsertRegime(row: RegimeRow): void;
  getRegimes(q: { regime_key?: string; asset?: string; slot?: number; as_of?: number }): RegimeRow[];
}

export function createDerivedDal(db: DB): DerivedDal {
  const insPctl = db.prepare(`
    INSERT OR REPLACE INTO factor_percentiles
      (stream, source, asset, instrument, slot, window_id, status, value, percentile, n_obs, vintage, staleness_ms, as_of, code_version, params, computed_at)
    VALUES
      (@stream, @source, @asset, @instrument, @slot, @window_id, @status, @value, @percentile, @n_obs, @vintage, @staleness_ms, @as_of, @code_version, @params, @computed_at)
  `);
  const insRegime = db.prepare(`
    INSERT OR REPLACE INTO factor_regimes
      (regime_key, asset, slot, regime_value, as_of, rule_version, params, computed_at)
    VALUES
      (@regime_key, @asset, @slot, @regime_value, @as_of, @rule_version, @params, @computed_at)
  `);

  const where = (clauses: string[]) => (clauses.length ? `WHERE ${clauses.join(" AND ")}` : "");

  return {
    upsertPercentile(row) {
      insPctl.run({ ...row, params: JSON.stringify(row.params) });
    },

    getPercentiles(q) {
      const clauses: string[] = [];
      const params: Record<string, unknown> = {};
      for (const k of ["stream", "asset", "slot", "window_id", "as_of"] as const) {
        if (q[k] !== undefined) {
          clauses.push(`${k} = @${k}`);
          params[k] = q[k];
        }
      }
      const rows = db
        .prepare(`SELECT * FROM factor_percentiles ${where(clauses)} ORDER BY slot DESC, window_id`)
        .all(params) as (Omit<PercentileRow, "params"> & { params: string })[];
      return rows.map((r) => ({ ...r, params: JSON.parse(r.params) as Record<string, unknown> }));
    },

    upsertRegime(row) {
      insRegime.run({ ...row, params: JSON.stringify(row.params) });
    },

    getRegimes(q) {
      const clauses: string[] = [];
      const params: Record<string, unknown> = {};
      for (const k of ["regime_key", "asset", "slot", "as_of"] as const) {
        if (q[k] !== undefined) {
          clauses.push(`${k} = @${k}`);
          params[k] = q[k];
        }
      }
      const rows = db
        .prepare(`SELECT * FROM factor_regimes ${where(clauses)} ORDER BY slot DESC, regime_key`)
        .all(params) as (Omit<RegimeRow, "params"> & { params: string })[];
      return rows.map((r) => ({ ...r, params: JSON.parse(r.params) as Record<string, unknown> }));
    },
  };
}
