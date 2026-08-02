import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * Config-driven source registry (config/sources.json). Adding a source of a
 * supported type requires ZERO code — just a JSON entry. Factor objects allow
 * unknown keys (.passthrough) so adapter-specific fields don't need a schema bump.
 */

const articleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.literal("rss"),
  url: z.string().url(),
  enabled: z.boolean().optional(),
});

const factorSchema = z
  .object({
    id: z.string().min(1),
    adapter: z.string().min(1),
    stream: z.string().min(1),
    source: z.string().min(1),
    assets: z.array(z.string()).optional(),
    instruments: z.array(z.string()).optional(),
    asset: z.string().optional(),
    series: z.string().optional(),
    interval_sec: z.number().int().positive(),
    enabled: z.boolean().optional(),
  })
  .passthrough();

const stubSchema = z.object({
  id: z.string().min(1),
  status: z.literal("stub"),
  reason: z.string().optional(),
  key: z.string().optional(),
});

export const sourcesSchema = z
  .object({
    articles: z.array(articleSchema).default([]),
    factors: z.array(factorSchema).default([]),
    stubbed: z.array(stubSchema).default([]),
  })
  .superRefine((cfg, ctx) => {
    const ids = [...cfg.articles, ...cfg.factors, ...cfg.stubbed].map((s) => s.id);
    const dup = ids.find((id, i) => ids.indexOf(id) !== i);
    if (dup) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate source id: ${dup}` });
    }
  });

export type SourcesConfig = z.infer<typeof sourcesSchema>;
export type ArticleSource = z.infer<typeof articleSchema>;
export type FactorSource = z.infer<typeof factorSchema>;
export type StubSource = z.infer<typeof stubSchema>;

const DEFAULT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../config/sources.json",
);

/** Validate an already-parsed config object (throws on invalid). */
export function parseSources(json: unknown): SourcesConfig {
  return sourcesSchema.parse(json);
}

/** Load + validate config/sources.json (or an explicit path, for tests). */
export function loadSources(path: string = DEFAULT_PATH): SourcesConfig {
  return parseSources(JSON.parse(readFileSync(path, "utf8")));
}

/** Enabled sources only (a source is enabled unless `enabled:false`). */
export function enabledArticles(cfg: SourcesConfig): ArticleSource[] {
  return cfg.articles.filter((a) => a.enabled !== false);
}
export function enabledFactors(cfg: SourcesConfig): FactorSource[] {
  return cfg.factors.filter((f) => f.enabled !== false);
}
