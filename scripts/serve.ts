import { loadLocalEnv } from "./_bootstrap";
import { createServer } from "node:http";
import { getDb } from "../src/lib/capture/db/client";
import { runMigrations } from "../src/lib/capture/db/migrate";
import { runForever } from "../src/lib/capture/scheduler";
import { loadSources } from "../src/lib/capture/sources";
import { captureConfig } from "../src/lib/capture/config";
import { loadSeedFromFile } from "../src/lib/mechanism/loader";
import { loadGraph } from "../src/lib/mechanism/graph";
import { logger } from "../src/lib/capture/logger";
import { agentConfig } from "../src/lib/agent/config";
import { createAgentApi, type ApiResponse } from "../src/lib/agent/api";
import { PooledLlm } from "../src/lib/agent/llm/router";
import { HttpNotifier } from "../src/lib/agent/notify";
import { startLoops } from "../src/lib/agent/service";
import { MemoryUserStore } from "../src/lib/agent/store/memory";
import { SupabaseUserStore } from "../src/lib/agent/store/supabase";
import type { UserStore } from "../src/lib/agent/store/types";

/**
 * The whole engine as ONE always-on process (single-service hosts such as
 * Railway, where a volume — and so the SQLite corpus — attaches to one service):
 *   capture daemon + derive/brief/watch loop + agent HTTP API (+ tool RPC).
 *   serve                 everything
 *   serve --no-capture    API + loops only (capture runs elsewhere on the same DB)
 */
loadLocalEnv();
const db = getDb();
runMigrations(db);

// Idempotent: a no-op when this seed version is already loaded.
try {
  loadGraph(db, loadSeedFromFile());
} catch (e) {
  logger.error("mechanism graph not loaded", { error: (e as Error).message });
}

const llm = new PooledLlm();
let store: UserStore;
if (agentConfig.supabaseUrl() && agentConfig.supabaseServiceKey()) {
  store = new SupabaseUserStore(agentConfig.supabaseUrl(), agentConfig.supabaseServiceKey());
} else {
  logger.warn("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY unset — using the IN-MEMORY user store (dev only: nothing persists across restarts)");
  store = new MemoryUserStore();
}
const notifier = new HttpNotifier({ telegramBotToken: agentConfig.telegramBotToken(), resendApiKey: agentConfig.resendApiKey(), alertFromEmail: agentConfig.alertFromEmail() });

const api = createAgentApi({
  db,
  llm,
  store,
  secret: agentConfig.sessionSecret(),
  limits: { dailyLlm: agentConfig.dailyAskLimit(), perMinute: agentConfig.perMinuteLimit(), maxWatches: agentConfig.maxWatchesPerUser() },
  telegramBotName: agentConfig.telegramBotName() || undefined,
  poolStatus: () => llm.status(),
});

const origin = agentConfig.allowedOrigin();
const cors: Record<string, string> = origin
  ? { "access-control-allow-origin": origin, "access-control-allow-headers": "authorization, content-type, accept", "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS", vary: "origin" }
  : {};

const MAX_BODY = 64 * 1024;

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  let body = "";
  let tooBig = false;
  req.on("data", (c: Buffer) => {
    body += c;
    if (body.length > MAX_BODY) tooBig = true;
  });
  req.on("end", async () => {
    if (tooBig) {
      res.writeHead(413, { "content-type": "application/json", ...cors });
      res.end(JSON.stringify({ error: "request too large" }));
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    let out: ApiResponse;
    try {
      out = await api({
        method: req.method ?? "GET",
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
        headers: { authorization: req.headers.authorization, accept: req.headers.accept },
        body,
      });
    } catch (e) {
      logger.error("agent api error", { path: url.pathname, error: (e as Error).message });
      out = { status: 500, body: { error: "internal error" } };
    }
    if (out.stream) {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", ...cors });
      await out.stream((event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      res.end();
      return;
    }
    res.writeHead(out.status, { "content-type": "application/json", ...cors });
    res.end(JSON.stringify(out.body ?? {}));
  });
});

const capture = process.argv.includes("--no-capture") ? null : runForever(db, loadSources(), captureConfig.tickMs());
const loops = startLoops({
  db,
  llm,
  store,
  notifier,
  pregenerateMarket: agentConfig.env("AGENT_PREGENERATE_MARKET") !== "0",
  deriveIntervalMs: agentConfig.deriveIntervalMs(),
  retentionDays: agentConfig.conversationRetentionDays(),
  telegramBotToken: agentConfig.telegramBotToken() || undefined,
});

server.listen(agentConfig.port(), () => logger.info("lensai serve", { port: agentConfig.port(), capture: !!capture, store: store.constructor.name, pool: llm.status().filter((p) => p.configured).map((p) => p.provider) }));

const shutdown = async () => {
  logger.info("shutdown signal received");
  loops.stop();
  capture?.stop();
  server.close();
  await capture?.done;
  db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
