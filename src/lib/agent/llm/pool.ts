import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

/**
 * Config-driven free-tier provider pool (config/llm-pool.json). Free models and
 * limits churn, so adding/retiring a provider or model is a JSON edit, not code.
 * Every provider speaks the OpenAI-compatible chat-completions shape.
 */

const providerSchema = z.object({
  id: z.string().min(1),
  base_url: z.string().url(),
  key_env: z.string().min(1),
  enabled: z.boolean().optional(),
  models: z.object({ strong: z.string().min(1), small: z.string().min(1) }),
  limits: z.object({ rpm: z.number().int().positive(), rpd: z.number().int().positive() }),
  /** Per-tier request-body extras (e.g. switch off hidden reasoning that eats the output budget).
   *  Per TIER because accepted values differ between a provider's own models. */
  extra: z.object({ strong: z.record(z.unknown()).optional(), small: z.record(z.unknown()).optional() }).optional(),
  _note: z.string().optional(),
});

export const poolSchema = z
  .object({ providers: z.array(providerSchema).min(1) })
  .passthrough()
  .superRefine((cfg, ctx) => {
    const ids = cfg.providers.map((p) => p.id);
    const dup = ids.find((id, i) => ids.indexOf(id) !== i);
    if (dup) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate provider id: ${dup}` });
    // The decision is ONE key per provider — two entries sharing a key env would be
    // the multi-account pooling pattern in disguise.
    const keys = cfg.providers.map((p) => p.key_env);
    const dupKey = keys.find((k, i) => keys.indexOf(k) !== i);
    if (dupKey) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `key env used twice: ${dupKey} (one key per provider)` });
  });

export type PoolConfig = z.infer<typeof poolSchema>;
export type ProviderConfig = z.infer<typeof providerSchema>;

const DEFAULT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../config/llm-pool.json");

export function parsePool(json: unknown): PoolConfig {
  return poolSchema.parse(json);
}

export function loadPool(path: string = DEFAULT_PATH): PoolConfig {
  return parsePool(JSON.parse(readFileSync(path, "utf8")));
}

const VAR = /\$\{([A-Z0-9_]+)\}/g;

/** Expand ${ENV_VAR} placeholders in a base URL (e.g. an account id); null if one is unset. */
export function resolveBaseUrl(baseUrl: string, getEnv: (name: string) => string | undefined): string | null {
  let missing = false;
  const out = baseUrl.replace(VAR, (_m, name: string) => {
    const v = getEnv(name);
    if (!v) missing = true;
    return v ?? "";
  });
  return missing ? null : out;
}

/** Providers that are enabled AND fully configured (key + any base-URL variables) in the environment. */
export function availableProviders(cfg: PoolConfig, getEnv: (name: string) => string | undefined = (n) => process.env[n]): ProviderConfig[] {
  return cfg.providers.filter((p) => p.enabled !== false && !!getEnv(p.key_env) && resolveBaseUrl(p.base_url, getEnv) !== null);
}
