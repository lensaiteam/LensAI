/**
 * The agent's LLM seam. Everything the agent asks of a model is ONE structured
 * JSON generation (plan / claims / rule / extraction) — never an open tool loop —
 * so any free model that can emit JSON is usable, and the fail-closed
 * verify + guardrail gates downstream keep a weak model from shipping a wrong
 * number. Returns `unknown`: callers zod-validate.
 */

/** `strong` = narration-grade reasoning; `small` = classify/extract/compile. */
export type Tier = "strong" | "small";

export interface JsonRequest {
  system: string;
  user: string;
  tier: Tier;
  /** Shape hint appended to the system prompt (models without json_schema support). */
  shapeHint?: string;
  maxTokens?: number;
  /** Provider ids to skip — used to retry a failed verification elsewhere. */
  exclude?: string[];
  /** This user's identifiers (wallet, email, chat id) — the privacy gate refuses a prompt containing any. */
  forbid?: string[];
}

export interface JsonResult {
  data: unknown;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface JsonLlm {
  generateJson(req: JsonRequest): Promise<JsonResult>;
}

/** Every provider is out of quota, cooling down, or unconfigured. */
export class PoolExhaustedError extends Error {
  constructor(public readonly attempts: { provider: string; error: string }[]) {
    super(`LLM pool exhausted (${attempts.length ? attempts.map((a) => `${a.provider}: ${a.error}`).join("; ") : "no provider available"})`);
    this.name = "PoolExhaustedError";
  }
}

/** A provider said "slow down" (HTTP 429) — the router cools it down. */
export class RateLimitedError extends Error {
  constructor(public readonly provider: string, public readonly retryAfterMs: number) {
    super(`${provider} rate limited`);
    this.name = "RateLimitedError";
  }
}

/** The provider answered, but not with usable JSON — fail over, but do NOT bench it like an outage. */
export class MalformedCompletionError extends Error {
  constructor(public readonly provider: string, detail: string) {
    super(`${provider} returned a malformed completion: ${detail}`);
    this.name = "MalformedCompletionError";
  }
}

/** Deterministic test double: answers from a queue (or a function of the request). */
export class MockJsonLlm implements JsonLlm {
  public calls: JsonRequest[] = [];
  constructor(private readonly answers: unknown[] | ((req: JsonRequest) => unknown), public name = "mock") {}
  async generateJson(req: JsonRequest): Promise<JsonResult> {
    this.calls.push(req);
    const data = typeof this.answers === "function" ? this.answers(req) : this.answers.shift();
    if (data instanceof Error) throw data;
    return { data, provider: this.name, model: "mock", inputTokens: 0, outputTokens: 0 };
  }
}
