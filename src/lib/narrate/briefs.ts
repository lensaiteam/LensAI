import type { DB } from "../capture/db/client";
import type { NarrateResult } from "./orchestrator";

/** Persistence for the calibration record (append-only briefs table). */
export const NARRATE_CODE_VERSION = "narrate-v1";

export interface BriefRow {
  id: number;
  surface: string;
  asset: string | null;
  as_of: number;
  text: string;
  claims_kept: number;
  claims_dropped: number;
  input_refs: string[];
  provider: string;
  code_version: string;
  created_at: number;
}

/** Append an emitted brief to the calibration record. */
export function persistBrief(db: DB, r: NarrateResult, createdAt: number = Date.now()): void {
  const inputRefs = [...new Set(r.audit.filter((a) => a.kept).flatMap((a) => a.refs))];
  db.prepare(
    `INSERT INTO briefs (surface, asset, as_of, text, claims_kept, claims_dropped, input_refs, audit, provider, code_version, created_at)
     VALUES (@surface, @asset, @as_of, @text, @kept, @dropped, @input_refs, @audit, @provider, @code_version, @created_at)`,
  ).run({
    surface: r.surface,
    asset: r.asset ?? null,
    as_of: r.asOf,
    text: r.text,
    kept: r.kept,
    dropped: r.dropped,
    input_refs: JSON.stringify(inputRefs),
    audit: JSON.stringify(r.audit),
    provider: r.provider,
    code_version: NARRATE_CODE_VERSION,
    created_at: createdAt,
  });
}

export function listBriefs(db: DB, q: { surface?: string; asset?: string; limit?: number } = {}): BriefRow[] {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (q.surface) { clauses.push("surface = @surface"); params.surface = q.surface; }
  if (q.asset) { clauses.push("asset = @asset"); params.asset = q.asset; }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const limit = q.limit ?? 20;
  const rows = db
    .prepare(`SELECT id, surface, asset, as_of, text, claims_kept, claims_dropped, input_refs, provider, code_version, created_at FROM briefs ${where} ORDER BY created_at DESC, id DESC LIMIT ${limit}`)
    .all(params) as (Omit<BriefRow, "input_refs"> & { input_refs: string })[];
  return rows.map((r) => ({ ...r, input_refs: JSON.parse(r.input_refs) as string[] }));
}
