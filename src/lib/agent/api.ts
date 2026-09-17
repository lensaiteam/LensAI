import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { DB } from "../capture/db/client";
import { handleRpc, type RpcRequest } from "../tools/rpc";
import { checkBearer } from "../tools/auth";
import { resolveComputedAnchor } from "../tools/handlers";
import { askAgent, type AskResult, type Stage } from "./ask";
import { authenticate, newApiKey, type Principal } from "./auth";
import { computeChanges } from "./changes";
import { checkClaims } from "./claimcheck";
import { PoolExhaustedError, type JsonLlm } from "./llm/types";
import { PromptPrivacyError, scrubIdentifiers } from "./privacy";
import type { UserStore } from "./store/types";
import { compileWatch } from "./watch/compile";
import { describeRule, loadVocabulary, ruleSchema, validateAgainstVocabulary } from "./watch/rule";

/**
 * The agent's HTTP surface as a PURE function (request → response), so every route
 * is testable in-process; scripts/serve.ts is the thin node:http adapter. Session
 * tokens reach everything; API keys reach only the read/ask surface (never account
 * management). Every store call is scoped to the authenticated wallet.
 */

export interface ApiDeps {
  db: DB;
  llm: JsonLlm;
  store: UserStore;
  secret: string;
  limits: { dailyLlm: number; perMinute: number; maxWatches: number };
  telegramBotName?: string;
  poolStatus?: () => unknown;
  now?: () => number;
}

export interface ApiRequest {
  method: string;
  path: string;
  query?: Record<string, string>;
  headers: Record<string, string | undefined>;
  body?: string;
}

export type Emit = (event: string, data: unknown) => void;

export interface ApiResponse {
  status: number;
  body?: unknown;
  /** Present for a streamed (SSE) answer: the adapter opens the stream and calls this. */
  stream?: (emit: Emit) => Promise<void>;
}

const json = (status: number, body: unknown): ApiResponse => ({ status, body });
const err = (status: number, message: string): ApiResponse => json(status, { error: message });
const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10);

const askBody = z.object({ question: z.string().min(1).max(1000), conversationId: z.string().uuid().optional() });
const watchCompileBody = z.object({ text: z.string().min(3).max(500) });
const watchCreateBody = z.object({ text: z.string().min(3).max(500), rule: ruleSchema, channel: z.enum(["telegram", "email"]) });
const watchPatchBody = z.object({ status: z.enum(["active", "paused"]).optional(), channel: z.enum(["telegram", "email"]).optional() });
const claimBody = z.object({ text: z.string().min(10).max(6000), save: z.boolean().optional() });
const prefsBody = z.object({
  watchlist: z.array(z.string().regex(/^[A-Za-z0-9]{1,12}$/)).max(50).optional(),
  timezone: z.string().max(64).nullable().optional(),
  email: z.string().email().max(254).nullable().optional(),
});
const keyBody = z.object({ label: z.string().min(1).max(60) });
const feedbackBody = z.object({ messageId: z.string().uuid(), rating: z.union([z.literal(1), z.literal(-1)]), note: z.string().max(500).optional() });

export function createAgentApi(deps: ApiDeps): (req: ApiRequest) => Promise<ApiResponse> {
  const now = deps.now ?? Date.now;
  const minute = new Map<string, number[]>();

  function rateLimited(wallet: string): boolean {
    const t = now();
    const hits = (minute.get(wallet) ?? []).filter((x) => t - x < 60_000);
    hits.push(t);
    minute.set(wallet, hits);
    return hits.length > deps.limits.perMinute;
  }

  function parse<S extends z.ZodTypeAny>(schema: S, body: string | undefined): z.output<S> | null {
    try {
      const r = schema.safeParse(JSON.parse(body || "{}"));
      return r.success ? r.data : null;
    } catch {
      return null;
    }
  }

  /** The user's identifiers — handed to the router's privacy gate on every model call. */
  async function forbidFor(wallet: string): Promise<string[]> {
    const p = await deps.store.getPrefs(wallet);
    return [wallet, p.email, p.telegramChatId].filter((x): x is string => !!x);
  }

  async function llmBudgetLeft(wallet: string): Promise<boolean> {
    return (await deps.store.getUsage(wallet, "llm", utcDay(now()))) < deps.limits.dailyLlm;
  }
  async function spend(wallet: string, calls: number): Promise<void> {
    for (let i = 0; i < calls; i++) await deps.store.bumpUsage(wallet, "llm", utcDay(now()));
  }

  async function ask(p: Principal, body: z.infer<typeof askBody>, onStage?: (s: Stage, d?: Record<string, unknown>) => void): Promise<ApiResponse> {
    const budget = await llmBudgetLeft(p.wallet);
    const question = scrubIdentifiers(body.question);

    let conversationId = body.conversationId;
    let history: string[] = [];
    let previousAssets: string[] = [];
    if (conversationId) {
      const msgs = await deps.store.getMessages(p.wallet, conversationId);
      if (!msgs) return err(404, "conversation not found");
      history = msgs.filter((m) => m.role === "user").map((m) => m.content).slice(-4);
      const lastMeta = [...msgs].reverse().find((m) => m.role === "assistant")?.meta as { assets?: string[] } | null | undefined;
      previousAssets = lastMeta?.assets ?? [];
    } else {
      conversationId = (await deps.store.createConversation(p.wallet, question.slice(0, 60))).id;
    }

    const prefs = await deps.store.getPrefs(p.wallet);
    let res: AskResult;
    try {
      // Out of daily budget → the model is not consulted at all; the agent still
      // serves shared briefs / arithmetic answers / the measured state.
      const llm: JsonLlm = budget ? deps.llm : { generateJson: async () => { throw new PoolExhaustedError([]); } };
      res = await askAgent({ db: deps.db, llm }, { question, history, previousAssets, lastSeenAsOf: prefs.lastSeenAsOf, forbid: await forbidFor(p.wallet), now: now(), onStage });
    } catch (e) {
      if (e instanceof PromptPrivacyError) return err(400, "The question contains a personal identifier the desk will not send to a model. Remove it and ask again.");
      throw e;
    }
    await spend(p.wallet, res.llmCalls);

    await deps.store.appendMessage(p.wallet, conversationId, { role: "user", content: question });
    const saved = await deps.store.appendMessage(p.wallet, conversationId, {
      role: "assistant",
      content: res.text,
      meta: { intent: res.intent, assets: res.assets, asOf: res.asOf, provider: res.provider, shared: res.shared, degraded: res.degraded, audit: res.audit },
    });
    if (res.asOf) await deps.store.setPrefs(p.wallet, { lastSeenAsOf: res.asOf });

    return json(200, { conversationId, messageId: saved?.id ?? null, ...res, budgetExhausted: !budget });
  }

  return async function handle(req: ApiRequest): Promise<ApiResponse> {
    const { method, path } = req;
    const seg = path.replace(/\/+$/, "").split("/").filter(Boolean);

    if (method === "GET" && path === "/health") {
      const anchor = resolveComputedAnchor(deps.db, now());
      return json(200, { ok: true, anchor: anchor?.as_of ?? null, pool: deps.poolStatus?.() ?? null });
    }

    // Tool endpoint (MCP-style JSON-RPC): the engine's SERA token OR a user credential.
    if (method === "POST" && path === "/rpc") {
      const allowed = checkBearer(req.headers.authorization) || !!(await authenticate(req.headers.authorization, deps));
      if (!allowed) return err(401, "unauthorized");
      try {
        return json(200, handleRpc(deps.db, JSON.parse(req.body || "") as RpcRequest));
      } catch {
        return json(400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } });
      }
    }

    if (seg[0] !== "v1") return err(404, "not found");
    const p = await authenticate(req.headers.authorization, deps);
    if (!p) return err(401, "unauthorized");
    if (rateLimited(p.wallet)) return err(429, "Too many requests — slow down.");
    await deps.store.touchUser(p.wallet);

    const route = `${method} /${seg.slice(1).join("/")}`;
    const id = seg[2];

    // ── read/ask surface (session OR api key) ─────────────────────────────
    if (route === "POST /ask") {
      const body = parse(askBody, req.body);
      if (!body) return err(400, "expected { question, conversationId? }");
      if ((req.headers.accept ?? "").includes("text/event-stream")) {
        return {
          status: 200,
          stream: async (emit) => {
            try {
              const r = await ask(p, body, (stage, detail) => emit("stage", { stage, ...detail }));
              emit(r.status === 200 ? "answer" : "error", r.body);
            } catch (e) {
              emit("error", { error: (e as Error).message });
            }
          },
        };
      }
      return ask(p, body);
    }

    if (route === "GET /changes") {
      const prefs = await deps.store.getPrefs(p.wallet);
      const asked = req.query?.since !== undefined && req.query.since !== "" ? Number(req.query.since) : NaN;
      const since = Number.isFinite(asked) ? asked : (prefs.lastSeenAsOf ?? now() - 86_400_000);
      const ch = computeChanges(deps.db, { since, asOf: now(), assets: req.query?.watchlist === "1" ? prefs.watchlist : undefined });
      if (req.query?.mark === "1" && ch.to) await deps.store.setPrefs(p.wallet, { lastSeenAsOf: ch.to.as_of });
      return json(200, ch);
    }

    if (route === "POST /claim-check") {
      const body = parse(claimBody, req.body);
      if (!body) return err(400, "expected { text (10–6000 chars), save? }");
      if (!(await llmBudgetLeft(p.wallet))) return err(429, "Daily analysis budget reached. It resets at 00:00 UTC.");
      try {
        const res = await checkClaims({ db: deps.db, llm: deps.llm }, body.text, { forbid: await forbidFor(p.wallet), now: now() });
        await spend(p.wallet, res.provider ? 1 : 0);
        const saved = body.save ? await deps.store.saveClaimCheck(p.wallet, { input: scrubIdentifiers(body.text), result: { asOf: res.asOf, claims: res.claims, text: res.text } }) : null;
        return json(200, { id: saved?.id ?? null, ...res });
      } catch (e) {
        if (e instanceof PoolExhaustedError) return err(503, "The desk's analysis capacity is exhausted right now. Try again shortly.");
        if (e instanceof PromptPrivacyError) return err(400, "The text contains a personal identifier the desk will not send to a model.");
        return err(422, "The text could not be checked.");
      }
    }

    if (route === "GET /usage") {
      return json(200, { day: utcDay(now()), used: await deps.store.getUsage(p.wallet, "llm", utcDay(now())), limit: deps.limits.dailyLlm });
    }

    // ── everything below manages the account: session only ────────────────
    if (p.via !== "session") return err(403, "API keys cannot manage the account; sign in with the wallet.");

    if (route === "GET /conversations") return json(200, { conversations: await deps.store.listConversations(p.wallet) });
    if (seg[1] === "conversations" && id) {
      if (method === "GET") {
        const messages = await deps.store.getMessages(p.wallet, id);
        return messages ? json(200, { messages }) : err(404, "conversation not found");
      }
      if (method === "DELETE") return (await deps.store.deleteConversation(p.wallet, id)) ? json(200, { deleted: true }) : err(404, "conversation not found");
    }

    if (route === "POST /watches/compile") {
      const body = parse(watchCompileBody, req.body);
      if (!body) return err(400, "expected { text }");
      if (!(await llmBudgetLeft(p.wallet))) return err(429, "Daily analysis budget reached. It resets at 00:00 UTC.");
      try {
        const res = await compileWatch(deps.llm, body.text, loadVocabulary(deps.db, now()), await forbidFor(p.wallet));
        await spend(p.wallet, 1);
        return json(200, res);
      } catch (e) {
        if (e instanceof PoolExhaustedError) return err(503, "The desk's analysis capacity is exhausted right now. Try again shortly.");
        if (e instanceof PromptPrivacyError) return err(400, "The watch text contains a personal identifier the desk will not send to a model.");
        throw e;
      }
    }
    if (route === "POST /watches") {
      const body = parse(watchCreateBody, req.body);
      if (!body) return err(400, "expected { text, rule, channel }");
      // The rule comes back from the client after confirmation — re-validate it.
      const problems = validateAgainstVocabulary(body.rule, loadVocabulary(deps.db, now()));
      if (problems.length) return err(422, problems.join("; "));
      if ((await deps.store.listWatches(p.wallet)).length >= deps.limits.maxWatches) return err(409, `Watch limit reached (${deps.limits.maxWatches}).`);
      const prefs = await deps.store.getPrefs(p.wallet);
      if (body.channel === "telegram" && !prefs.telegramChatId) return err(409, "Link Telegram before creating a Telegram watch.");
      if (body.channel === "email" && !prefs.email) return err(409, "Add an email address before creating an email watch.");
      const watch = await deps.store.createWatch(p.wallet, { text: scrubIdentifiers(body.text), rule: body.rule, description: describeRule(body.rule), channel: body.channel });
      return json(201, { watch });
    }
    if (route === "GET /watches") return json(200, { watches: await deps.store.listWatches(p.wallet) });
    if (seg[1] === "watches" && id) {
      if (method === "GET" && seg[3] === "triggers") return json(200, { triggers: await deps.store.listTriggers(p.wallet, id) });
      if (method === "PATCH") {
        const body = parse(watchPatchBody, req.body);
        if (!body) return err(400, "expected { status?, channel? }");
        const watch = await deps.store.updateWatch(p.wallet, id, body);
        return watch ? json(200, { watch }) : err(404, "watch not found");
      }
      if (method === "DELETE") return (await deps.store.deleteWatch(p.wallet, id)) ? json(200, { deleted: true }) : err(404, "watch not found");
    }

    if (route === "GET /claim-checks") return json(200, { claimChecks: await deps.store.listClaimChecks(p.wallet) });
    if (seg[1] === "claim-checks" && id && method === "DELETE") return (await deps.store.deleteClaimCheck(p.wallet, id)) ? json(200, { deleted: true }) : err(404, "not found");

    if (route === "GET /prefs") {
      const { telegramLinkCode: _c, ...prefs } = await deps.store.getPrefs(p.wallet);
      return json(200, { prefs });
    }
    if (route === "PUT /prefs") {
      const body = parse(prefsBody, req.body);
      if (!body) return err(400, "expected { watchlist?, timezone?, email? }");
      const patch = { ...body, ...(body.watchlist ? { watchlist: [...new Set(body.watchlist.map((s) => s.toUpperCase()))] } : {}) };
      const { telegramLinkCode: _c, ...prefs } = await deps.store.setPrefs(p.wallet, patch);
      return json(200, { prefs });
    }
    if (route === "POST /telegram/link") {
      const code = randomBytes(12).toString("base64url");
      await deps.store.setPrefs(p.wallet, { telegramLinkCode: code });
      return json(200, { code, url: deps.telegramBotName ? `https://t.me/${deps.telegramBotName}?start=${code}` : null });
    }
    if (route === "DELETE /telegram/link") {
      await deps.store.setPrefs(p.wallet, { telegramChatId: null, telegramLinkCode: null });
      return json(200, { unlinked: true });
    }

    if (route === "GET /api-keys") return json(200, { keys: await deps.store.listApiKeys(p.wallet) });
    if (route === "POST /api-keys") {
      const body = parse(keyBody, req.body);
      if (!body) return err(400, "expected { label }");
      if ((await deps.store.listApiKeys(p.wallet)).filter((k) => !k.revoked).length >= 5) return err(409, "API key limit reached (5).");
      const k = newApiKey();
      const rec = await deps.store.createApiKey(p.wallet, { label: body.label, hash: k.hash, prefix: k.prefix });
      return json(201, { key: k.key, record: rec, note: "Shown once. Only a hash is stored." });
    }
    if (seg[1] === "api-keys" && id && method === "DELETE") return (await deps.store.revokeApiKey(p.wallet, id)) ? json(200, { revoked: true }) : err(404, "not found");

    if (route === "POST /feedback") {
      const body = parse(feedbackBody, req.body);
      if (!body) return err(400, "expected { messageId, rating: 1|-1, note? }");
      await deps.store.addFeedback(p.wallet, { ...body, note: body.note ? scrubIdentifiers(body.note) : undefined });
      return json(200, { recorded: true });
    }

    if (route === "GET /export") return json(200, await deps.store.exportAll(p.wallet));
    if (route === "DELETE /account") {
      await deps.store.deleteAll(p.wallet);
      return json(200, { deleted: true, note: "All agent data for this wallet has been erased." });
    }

    return err(404, "not found");
  };
}
