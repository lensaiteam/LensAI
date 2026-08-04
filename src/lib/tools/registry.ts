import { z } from "zod";
import type { DB } from "../capture/db/client";
import * as h from "./handlers";

/**
 * Tool registry — the router-facing surface. Each tool's `description` is what an
 * embedding router (SERA) embeds to decide when to call it, so descriptions say
 * what the tool returns and when to use it. `input` (zod) validates calls;
 * `jsonSchema` is the machine-readable schema advertised in tools/list.
 */
export interface ToolDef {
  name: string;
  description: string;
  input: z.ZodType<unknown>;
  jsonSchema: Record<string, unknown>;
  handler: (db: DB, input: Record<string, unknown>) => unknown;
}

const asOf = { asOf: { type: "number", description: "Point-in-time anchor (epoch ms). Omit for latest." } };
const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: "object", properties, required, additionalProperties: false });

export const TOOLS: ToolDef[] = [
  {
    name: "get_market_state",
    description: "Whole-market structural read as of a point in time: factor regimes, fired structural signatures (spot-led vs leverage-led, fragile), and divergence flags. Non-advisory — describes structure, not what to do.",
    input: z.object({ asOf: z.number().optional() }),
    jsonSchema: obj({ ...asOf }),
    handler: (db, i) => h.getMarketState(db, i as { asOf?: number }),
  },
  {
    name: "get_token_factor_state",
    description: "Per-token factor state: each stream's percentile vs its own history across named windows (90d/365d/full), regimes, staleness and vintage. Use to read a single token in context.",
    input: z.object({ asset: z.string().min(1), asOf: z.number().optional() }),
    jsonSchema: obj({ asset: { type: "string" }, ...asOf }, ["asset"]),
    handler: (db, i) => h.getTokenFactorState(db, i as { asset: string; asOf?: number }),
  },
  {
    name: "get_divergences",
    description: "Fired divergence flags at a point in time: historically extreme factor states, broken cross-factor relationships, and structural signatures — each with its input provenance.",
    input: z.object({ asOf: z.number().optional(), kind: z.enum(["extreme_state", "broken_relationship", "structural_signature"]).optional(), asset: z.string().optional() }),
    jsonSchema: obj({ ...asOf, kind: { type: "string", enum: ["extreme_state", "broken_relationship", "structural_signature"] }, asset: { type: "string" } }),
    handler: (db, i) => h.getDivergences(db, i as { asOf?: number; kind?: string; asset?: string }),
  },
  {
    name: "get_mechanism",
    description: "Documented transmission channels from the curated mechanism graph (point-in-time): directed edges with polarity, mechanism rationale, lifecycle, and a curated-prior strength. Filter by node or channel.",
    input: z.object({ node: z.string().optional(), channel: z.string().optional(), asOf: z.number().optional() }),
    jsonSchema: obj({ node: { type: "string" }, channel: { type: "string" }, ...asOf }),
    handler: (db, i) => h.getMechanism(db, i as { node?: string; channel?: string; asOf?: number }),
  },
  {
    name: "get_factor_series",
    description: "Point-in-time history of one factor series (observed_at, value), latest revision known at the anchor. Use for trend/context, not percentiles.",
    input: z.object({ stream: z.string().min(1), asset: z.string().min(1), source: z.string().optional(), asOf: z.number().optional(), limit: z.number().int().positive().optional() }),
    jsonSchema: obj({ stream: { type: "string" }, asset: { type: "string" }, source: { type: "string" }, ...asOf, limit: { type: "number" } }, ["stream", "asset"]),
    handler: (db, i) => h.getFactorSeries(db, i as { stream: string; asset: string; source?: string; asOf?: number; limit?: number }),
  },
  {
    name: "search_corpus",
    description: "Search the immutable point-in-time article corpus by asset/keyword; returns title, url, source, publish time and content hash (provenance). Never returns rows captured after the anchor.",
    input: z.object({ asset: z.string().optional(), query: z.string().optional(), since: z.number().optional(), asOf: z.number().optional(), limit: z.number().int().positive().optional() }),
    jsonSchema: obj({ asset: { type: "string" }, query: { type: "string" }, since: { type: "number" }, ...asOf, limit: { type: "number" } }),
    handler: (db, i) => h.searchCorpus(db, i as { asset?: string; query?: string; since?: number; asOf?: number; limit?: number }),
  },
  {
    name: "get_claims",
    description: "Typed mechanism claims (claimant, incentive, time, text, mechanism refs) from the corpus, point-in-time. May be empty until extraction jobs run.",
    input: z.object({ asOf: z.number().optional(), claimant: z.string().optional(), limit: z.number().int().positive().optional() }),
    jsonSchema: obj({ ...asOf, claimant: { type: "string" }, limit: { type: "number" } }),
    handler: (db, i) => h.getClaims(db, i as { asOf?: number; claimant?: string; limit?: number }),
  },
];

export function toolByName(name: string): ToolDef | undefined {
  return TOOLS.find((t) => t.name === name);
}
