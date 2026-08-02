import type { DB } from "./client";
import { normalizeText } from "../normalize";
import { sha256, hashObservation, hashClaim } from "../hash";
import type { ArticleInput, ObservationInput, ClaimInput, InsertResult } from "../types";

/**
 * Data-access layer for the capture corpus.
 *
 * INVARIANT 2 (point-in-time) is enforced HERE, not at call sites: every read
 * requires an `asOf` and injects `captured_at <= asOf`, so a caller cannot
 * observe a row that did not exist yet at the anchor instant. There is no public
 * un-gated read of the corpus tables. Lookahead bias is structurally impossible.
 *
 * Writes are append-only (the DB triggers reject UPDATE/DELETE) and dedupe via
 * ON CONFLICT DO NOTHING on each table's natural key.
 */

export interface ArticleRow {
  id: number;
  source: string;
  url: string;
  guid: string | null;
  title: string | null;
  author: string | null;
  published_at: number | null;
  captured_at: number;
  content_hash: string;
  raw_html: string | null;
  extracted_text: string;
  lang: string | null;
}

export interface ObservationRow {
  id: number;
  stream: string;
  source: string;
  asset: string;
  instrument: string;
  value: number | null;
  unit: string | null;
  observed_at: number;
  captured_at: number;
  metadata: Record<string, unknown> | null;
  content_hash: string;
}

export interface ClaimRow {
  id: number;
  article_id: number | null;
  claimant: string;
  claimant_incentive: string | null;
  claimed_at: number | null;
  claim_text: string;
  mechanism_refs: string[] | null;
  content_hash: string;
  captured_at: number;
}

export interface ArticleReadOpts {
  asOf: number | Date;
  source?: string;
  since?: number | Date;
  limit?: number;
}

export interface ClaimReadOpts {
  asOf: number | Date;
  claimant?: string;
  since?: number | Date;
  limit?: number;
}

export interface ObservationReadOpts {
  asOf: number | Date;
  stream?: string;
  source?: string;
  asset?: string;
  instrument?: string;
  since?: number | Date;
  limit?: number;
}

function ms(t: number | Date): number {
  return t instanceof Date ? t.getTime() : t;
}

function requireAsOf(asOf: number | Date | undefined): number {
  if (asOf === undefined || asOf === null) {
    throw new Error("DAL read requires an `asOf` (point-in-time invariant).");
  }
  const n = ms(asOf);
  if (!Number.isFinite(n)) throw new Error("DAL read: `asOf` is not a valid time.");
  return n;
}

export interface CaptureDal {
  insertArticle(input: ArticleInput, capturedAt?: number): InsertResult;
  insertObservation(input: ObservationInput, capturedAt?: number): InsertResult;
  insertClaim(input: ClaimInput, capturedAt?: number): InsertResult;
  getArticles(opts: ArticleReadOpts): ArticleRow[];
  getObservations(opts: ObservationReadOpts): ObservationRow[];
  getClaims(opts: ClaimReadOpts): ClaimRow[];
}

export function createDal(db: DB): CaptureDal {
  const insArticle = db.prepare(`
    INSERT INTO articles
      (source, url, guid, title, author, published_at, captured_at, content_hash, raw_html, extracted_text, lang)
    VALUES
      (@source, @url, @guid, @title, @author, @published_at, @captured_at, @content_hash, @raw_html, @extracted_text, @lang)
    ON CONFLICT (source, content_hash) DO NOTHING
  `);

  const insObs = db.prepare(`
    INSERT INTO factor_observations
      (stream, source, asset, instrument, value, unit, observed_at, captured_at, metadata, content_hash)
    VALUES
      (@stream, @source, @asset, @instrument, @value, @unit, @observed_at, @captured_at, @metadata, @content_hash)
    ON CONFLICT (stream, source, asset, instrument, observed_at, content_hash) DO NOTHING
  `);

  const insClaim = db.prepare(`
    INSERT INTO claims
      (article_id, claimant, claimant_incentive, claimed_at, claim_text, mechanism_refs, content_hash, captured_at)
    VALUES
      (@article_id, @claimant, @claimant_incentive, @claimed_at, @claim_text, @mechanism_refs, @content_hash, @captured_at)
    ON CONFLICT (content_hash) DO NOTHING
  `);

  return {
    insertArticle(input, capturedAt = Date.now()): InsertResult {
      const extracted = normalizeText(input.extractedText);
      const content_hash = sha256(extracted);
      const info = insArticle.run({
        source: input.source,
        url: input.url,
        guid: input.guid ?? null,
        title: input.title ?? null,
        author: input.author ?? null,
        published_at: input.publishedAt ?? null,
        captured_at: capturedAt,
        content_hash,
        raw_html: input.rawHtml ?? null,
        extracted_text: extracted,
        lang: input.lang ?? null,
      });
      const inserted = info.changes > 0;
      return { inserted, id: inserted ? Number(info.lastInsertRowid) : null };
    },

    insertObservation(input, capturedAt = Date.now()): InsertResult {
      const content_hash = hashObservation(input);
      const info = insObs.run({
        stream: input.stream,
        source: input.source,
        asset: input.asset,
        instrument: input.instrument ?? "",
        value: input.value ?? null,
        unit: input.unit ?? null,
        observed_at: input.observedAt,
        captured_at: capturedAt,
        metadata: input.metadata != null ? JSON.stringify(input.metadata) : null,
        content_hash,
      });
      const inserted = info.changes > 0;
      return { inserted, id: inserted ? Number(info.lastInsertRowid) : null };
    },

    insertClaim(input, capturedAt = Date.now()): InsertResult {
      const content_hash = hashClaim(input);
      const info = insClaim.run({
        article_id: input.articleId ?? null,
        claimant: input.claimant,
        claimant_incentive: input.claimantIncentive ?? null,
        claimed_at: input.claimedAt ?? null,
        claim_text: input.claimText,
        mechanism_refs: input.mechanismRefs != null ? JSON.stringify(input.mechanismRefs) : null,
        content_hash,
        captured_at: capturedAt,
      });
      const inserted = info.changes > 0;
      return { inserted, id: inserted ? Number(info.lastInsertRowid) : null };
    },

    getArticles(opts): ArticleRow[] {
      const asOf = requireAsOf(opts.asOf);
      const where: string[] = ["captured_at <= @asOf"];
      const params: Record<string, unknown> = { asOf };
      if (opts.source) {
        where.push("source = @source");
        params.source = opts.source;
      }
      if (opts.since !== undefined) {
        where.push("captured_at >= @since");
        params.since = ms(opts.since);
      }
      let sql = `SELECT * FROM articles WHERE ${where.join(" AND ")} ORDER BY captured_at DESC, id DESC`;
      if (opts.limit !== undefined) {
        sql += " LIMIT @limit";
        params.limit = opts.limit;
      }
      return db.prepare(sql).all(params) as ArticleRow[];
    },

    getObservations(opts): ObservationRow[] {
      const asOf = requireAsOf(opts.asOf);
      const where: string[] = ["captured_at <= @asOf"];
      const params: Record<string, unknown> = { asOf };
      if (opts.stream) {
        where.push("stream = @stream");
        params.stream = opts.stream;
      }
      if (opts.source) {
        where.push("source = @source");
        params.source = opts.source;
      }
      if (opts.asset) {
        where.push("asset = @asset");
        params.asset = opts.asset;
      }
      if (opts.instrument !== undefined) {
        where.push("instrument = @instrument");
        params.instrument = opts.instrument;
      }
      if (opts.since !== undefined) {
        where.push("captured_at >= @since");
        params.since = ms(opts.since);
      }
      let sql = `SELECT * FROM factor_observations WHERE ${where.join(" AND ")} ORDER BY observed_at DESC, captured_at DESC, id DESC`;
      if (opts.limit !== undefined) {
        sql += " LIMIT @limit";
        params.limit = opts.limit;
      }
      const rows = db.prepare(sql).all(params) as (Omit<ObservationRow, "metadata"> & { metadata: string | null })[];
      return rows.map((r) => ({ ...r, metadata: r.metadata ? (JSON.parse(r.metadata) as Record<string, unknown>) : null }));
    },

    getClaims(opts): ClaimRow[] {
      const asOf = requireAsOf(opts.asOf);
      const where: string[] = ["captured_at <= @asOf"];
      const params: Record<string, unknown> = { asOf };
      if (opts.claimant) {
        where.push("claimant = @claimant");
        params.claimant = opts.claimant;
      }
      if (opts.since !== undefined) {
        where.push("captured_at >= @since");
        params.since = ms(opts.since);
      }
      let sql = `SELECT * FROM claims WHERE ${where.join(" AND ")} ORDER BY captured_at DESC, id DESC`;
      if (opts.limit !== undefined) {
        sql += " LIMIT @limit";
        params.limit = opts.limit;
      }
      const rows = db.prepare(sql).all(params) as (Omit<ClaimRow, "mechanism_refs"> & { mechanism_refs: string | null })[];
      return rows.map((r) => ({ ...r, mechanism_refs: r.mechanism_refs ? (JSON.parse(r.mechanism_refs) as string[]) : null }));
    },
  };
}
