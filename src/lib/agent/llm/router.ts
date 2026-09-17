import { logger } from "../../capture/logger";
import { assertPromptClean } from "../privacy";
import { callOpenAiCompat, type FetchFn } from "./openaiCompat";
import { availableProviders, loadPool, type PoolConfig } from "./pool";
import { QuotaTracker } from "./quota";
import { MalformedCompletionError, PoolExhaustedError, RateLimitedError, type JsonLlm, type JsonRequest, type JsonResult } from "./types";

/**
 * Quota-aware router over the free pool. For each request: take the providers
 * that have a key, are not cooling down and have rpm/rpd headroom; try the one
 * with the MOST headroom first; on any failure fail over to the next. A 429 cools
 * the provider down; another error benches it briefly. One request = one model
 * (no mid-generation switching). The privacy gate runs before anything is sent.
 */

const ERROR_BENCH_MS = 30_000;

export interface RouterOptions {
  pool?: PoolConfig;
  quota?: QuotaTracker;
  fetchFn?: FetchFn;
  getEnv?: (name: string) => string | undefined;
  /** Identifiers that must never appear in a prompt (wallet, email, chat id). */
  forbidden?: () => string[];
}

export class PooledLlm implements JsonLlm {
  private readonly pool: PoolConfig;
  private readonly quota: QuotaTracker;
  private readonly fetchFn?: FetchFn;
  private readonly getEnv: (name: string) => string | undefined;
  private readonly forbidden: () => string[];

  constructor(opts: RouterOptions = {}) {
    this.pool = opts.pool ?? loadPool();
    this.quota = opts.quota ?? new QuotaTracker();
    this.fetchFn = opts.fetchFn;
    this.getEnv = opts.getEnv ?? ((n) => process.env[n]);
    this.forbidden = opts.forbidden ?? (() => []);
  }

  async generateJson(req: JsonRequest): Promise<JsonResult> {
    const system = req.shapeHint ? `${req.system}\n\nRespond with ONE JSON object only, of this shape:\n${req.shapeHint}` : req.system;
    assertPromptClean(`${system}\n${req.user}`, [...this.forbidden(), ...(req.forbid ?? [])]);

    const candidates = availableProviders(this.pool, this.getEnv)
      .filter((p) => !req.exclude?.includes(p.id) && this.quota.canUse(p.id, p.limits))
      .sort((a, b) => this.quota.utilization(a.id, a.limits) - this.quota.utilization(b.id, b.limits));

    const attempts: { provider: string; error: string }[] = [];
    for (const p of candidates) {
      const model = p.models[req.tier];
      this.quota.record(p.id);
      try {
        const out = await callOpenAiCompat(
          { providerId: p.id, baseUrl: p.base_url, apiKey: this.getEnv(p.key_env)!, model, system, user: req.user, maxTokens: req.maxTokens ?? 2000, extraBody: p.extra },
          this.fetchFn,
        );
        return { data: out.data, provider: p.id, model, inputTokens: out.inputTokens, outputTokens: out.outputTokens };
      } catch (e) {
        const msg = (e as Error).message;
        attempts.push({ provider: p.id, error: msg });
        if (!(e instanceof MalformedCompletionError)) this.quota.cooldown(p.id, e instanceof RateLimitedError ? e.retryAfterMs : ERROR_BENCH_MS);
        logger.warn("llm provider failed; failing over", { provider: p.id, model, error: msg });
      }
    }
    throw new PoolExhaustedError(attempts);
  }

  /** Pool health for /health and the busy-state UI. */
  status(): { provider: string; configured: boolean; minute: number; day: number; rpm: number; rpd: number; coolingDown: boolean }[] {
    return this.pool.providers
      .filter((p) => p.enabled !== false)
      .map((p) => ({ provider: p.id, configured: !!this.getEnv(p.key_env), ...this.quota.snapshot(p.id, p.limits) }));
  }
}
