import { describe, it, expect } from "vitest";
import { loadPool, parsePool, availableProviders, resolveBaseUrl } from "@/lib/agent/llm/pool";
import { QuotaTracker } from "@/lib/agent/llm/quota";
import { PooledLlm } from "@/lib/agent/llm/router";
import { extractJson, type FetchFn } from "@/lib/agent/llm/openaiCompat";
import { PoolExhaustedError } from "@/lib/agent/llm/types";
import { PromptPrivacyError, scrubIdentifiers, assertPromptClean } from "@/lib/agent/privacy";

const pool = parsePool({
  providers: [
    { id: "a", base_url: "https://a.test/v1", key_env: "A_KEY", models: { strong: "a-big", small: "a-small" }, limits: { rpm: 2, rpd: 5 } },
    { id: "b", base_url: "https://b.test/v1", key_env: "B_KEY", models: { strong: "b-big", small: "b-small" }, limits: { rpm: 2, rpd: 5 } },
    { id: "c", base_url: "https://c.test/v1", key_env: "C_KEY", models: { strong: "c-big", small: "c-small" }, limits: { rpm: 2, rpd: 5 } },
  ],
});
const env = (keys: string[]) => (n: string) => (keys.includes(n) ? "k" : undefined);

function okFetch(payload: unknown, seen: string[] = []): FetchFn {
  return async (url, init) => {
    seen.push(`${url} ${(JSON.parse(init.body) as { model: string }).model}`);
    return { ok: true, status: 200, headers: { get: () => null }, text: async () => JSON.stringify({ choices: [{ message: { content: JSON.stringify(payload) } }], usage: { prompt_tokens: 7, completion_tokens: 3 } }) };
  };
}

describe("pool config", () => {
  it("the shipped config/llm-pool.json is valid", () => {
    expect(loadPool().providers.length).toBeGreaterThan(2);
  });
  it("rejects two providers sharing a key env (one key per provider)", () => {
    const p = pool.providers[0];
    expect(() => parsePool({ providers: [p, { ...p, id: "a2" }] })).toThrow(/one key per provider/);
  });
  it("expands ${VARS} in a base url and hides the provider until they are set", () => {
    const cf = parsePool({ providers: [{ ...pool.providers[0], base_url: "https://api.test/accounts/${ACCT_ID}/v1" }] });
    expect(availableProviders(cf, env(["A_KEY"]))).toHaveLength(0);
    expect(availableProviders(cf, env(["A_KEY", "ACCT_ID"]))).toHaveLength(1);
    expect(resolveBaseUrl("https://api.test/accounts/${ACCT_ID}/v1", () => "42")).toBe("https://api.test/accounts/42/v1");
  });

  it("only providers with a key are available", () => {
    expect(availableProviders(pool, env(["B_KEY"])).map((p) => p.id)).toEqual(["b"]);
  });
});

describe("quota tracker", () => {
  it("enforces rpm, rolls the window, enforces rpd and cooldown", () => {
    let t = 1_000_000;
    const q = new QuotaTracker(() => t);
    const lim = { rpm: 2, rpd: 3 };
    q.record("x"); q.record("x");
    expect(q.canUse("x", lim)).toBe(false); // rpm
    t += 61_000;
    expect(q.canUse("x", lim)).toBe(true);
    q.record("x");
    expect(q.canUse("x", lim)).toBe(false); // rpd
    t += 86_400_000;
    expect(q.canUse("x", lim)).toBe(true); // new UTC day
    q.cooldown("x", 5000);
    expect(q.canUse("x", lim)).toBe(false);
    t += 5001;
    expect(q.canUse("x", lim)).toBe(true);
  });
});

describe("router", () => {
  it("prefers the provider with the most headroom and picks the tier's model", async () => {
    const quota = new QuotaTracker();
    quota.record("a");
    const seen: string[] = [];
    const llm = new PooledLlm({ pool, quota, fetchFn: okFetch({ ok: 1 }, seen), getEnv: env(["A_KEY", "B_KEY"]) });
    const r = await llm.generateJson({ system: "s", user: "u", tier: "small" });
    expect(r.provider).toBe("b");
    expect(r.data).toEqual({ ok: 1 });
    expect(r.inputTokens).toBe(7);
    expect(seen[0]).toBe("https://b.test/v1/chat/completions b-small");
  });

  it("fails over on error and cools down a 429'd provider", async () => {
    const quota = new QuotaTracker();
    let n = 0;
    const fetchFn: FetchFn = async (url) => {
      n++;
      if (url.startsWith("https://a.test")) return { ok: false, status: 429, headers: { get: () => "120" }, text: async () => "slow down" };
      return okFetch({ v: 2 })(url, { method: "POST", headers: {}, body: JSON.stringify({ model: "m" }) });
    };
    const llm = new PooledLlm({ pool, quota, fetchFn, getEnv: env(["A_KEY", "B_KEY"]) });
    const r = await llm.generateJson({ system: "s", user: "u", tier: "strong" });
    expect(r.provider).toBe("b");
    expect(n).toBe(2);
    expect(quota.canUse("a", { rpm: 2, rpd: 5 })).toBe(false); // cooling down
  });

  it("sends per-tier body extras and retries a transient 5xx once before failing over", async () => {
    const tiered = parsePool({ providers: [{ ...pool.providers[0], extra: { strong: { reasoning_effort: "none" } } }] });
    const bodies: Record<string, unknown>[] = [];
    let n = 0;
    const fetchFn: FetchFn = async (url, init) => {
      bodies.push(JSON.parse(init.body) as Record<string, unknown>);
      if (n++ === 0) return { ok: false, status: 503, headers: { get: () => null }, text: async () => "busy" };
      return okFetch({ v: 1 })(url, init);
    };
    const llm = new PooledLlm({ pool: tiered, fetchFn, getEnv: env(["A_KEY"]) });
    const r = await llm.generateJson({ system: "s", user: "u", tier: "strong" });
    expect(r.provider).toBe("a"); // same provider, second attempt
    expect(bodies).toHaveLength(2);
    expect(bodies[0].reasoning_effort).toBe("none");
    await llm.generateJson({ system: "s", user: "u", tier: "small" });
    expect(bodies[2].reasoning_effort).toBeUndefined();
  });

  it("honours exclude, and throws PoolExhaustedError when nothing is left", async () => {
    const llm = new PooledLlm({ pool, fetchFn: okFetch({}), getEnv: env(["A_KEY"]) });
    await expect(llm.generateJson({ system: "s", user: "u", tier: "small", exclude: ["a"] })).rejects.toBeInstanceOf(PoolExhaustedError);
  });

  it("REFUSES to send a prompt carrying a user identifier (privacy gate)", async () => {
    const seen: string[] = [];
    const llm = new PooledLlm({ pool, fetchFn: okFetch({}, seen), getEnv: env(["A_KEY"]) });
    const wallet = "0x52908400098527886E0F7030069857D2E4169EE7";
    await expect(llm.generateJson({ system: "s", user: `what about ${wallet}?`, tier: "small" })).rejects.toBeInstanceOf(PromptPrivacyError);
    await expect(llm.generateJson({ system: "s", user: "chat 987654321 asks", tier: "small", forbid: ["987654321"] })).rejects.toBeInstanceOf(PromptPrivacyError);
    expect(seen).toHaveLength(0); // nothing left the process
  });
});

describe("privacy helpers", () => {
  it("scrubs wallets, emails, ENS names and handles", () => {
    const s = scrubIdentifiers("I'm vitalik.eth (0x52908400098527886E0F7030069857D2E4169EE7), mail me a@b.io or @some_handle");
    expect(s).not.toMatch(/0x5290|vitalik\.eth|a@b\.io|@some_handle/);
    expect(() => assertPromptClean(s)).not.toThrow();
  });
});

describe("extractJson", () => {
  it("handles fenced and prose-wrapped objects", () => {
    expect(extractJson('Sure!\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('here: {"b":{"c":2}} done')).toEqual({ b: { c: 2 } });
    expect(() => extractJson("no json")).toThrow();
  });
});
