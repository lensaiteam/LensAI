import type { DB } from "../capture/db/client";
import type { DivergenceFlag } from "./types";

/** DAL for the derived factor_divergences table (idempotent INSERT OR REPLACE). */

export interface DivergenceRow extends DivergenceFlag {
  slot: number;
  as_of: number;
  code_version: string;
  params: Record<string, unknown>;
  computed_at: number;
}

export interface DivergenceQuery {
  kind?: string;
  slot?: number;
  as_of?: number;
  fired?: boolean;
}

export interface DivergenceDal {
  upsert(row: DivergenceRow): void;
  get(q: DivergenceQuery): DivergenceRow[];
}

export function createDivergenceDal(db: DB): DivergenceDal {
  const ins = db.prepare(`
    INSERT OR REPLACE INTO factor_divergences
      (kind, subject, window_id, slot, as_of, fired, magnitude, status, vintage, detail, code_version, params, computed_at)
    VALUES
      (@kind, @subject, @window_id, @slot, @as_of, @fired, @magnitude, @status, @vintage, @detail, @code_version, @params, @computed_at)
  `);

  return {
    upsert(row) {
      ins.run({
        kind: row.kind,
        subject: row.subject,
        window_id: row.window_id,
        slot: row.slot,
        as_of: row.as_of,
        fired: row.fired ? 1 : 0,
        magnitude: row.magnitude,
        status: row.status,
        vintage: row.vintage,
        detail: JSON.stringify(row.detail),
        code_version: row.code_version,
        params: JSON.stringify(row.params),
        computed_at: row.computed_at,
      });
    },

    get(q) {
      const clauses: string[] = [];
      const params: Record<string, unknown> = {};
      if (q.kind !== undefined) { clauses.push("kind = @kind"); params.kind = q.kind; }
      if (q.slot !== undefined) { clauses.push("slot = @slot"); params.slot = q.slot; }
      if (q.as_of !== undefined) { clauses.push("as_of = @as_of"); params.as_of = q.as_of; }
      if (q.fired !== undefined) { clauses.push("fired = @fired"); params.fired = q.fired ? 1 : 0; }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const rows = db.prepare(`SELECT * FROM factor_divergences ${where} ORDER BY kind, subject`).all(params) as (Omit<DivergenceRow, "fired" | "detail" | "params"> & { fired: number; detail: string; params: string })[];
      return rows.map((r) => ({
        ...r,
        fired: r.fired === 1,
        detail: JSON.parse(r.detail) as Record<string, unknown>,
        params: JSON.parse(r.params) as Record<string, unknown>,
      })) as DivergenceRow[];
    },
  };
}
