import { loadLocalEnv } from "./_bootstrap";
import { createServer } from "node:http";
import { createInterface } from "node:readline";
import { getDb } from "../src/lib/capture/db/client";
import { runMigrations } from "../src/lib/capture/db/migrate";
import { handleStdioLine, handleHttpRpc } from "../src/lib/tools/transport";
import { logger } from "../src/lib/capture/logger";

/**
 * Read-only tool server for SERA's router.
 *   tools-server                 stdio (newline-delimited JSON-RPC; local subprocess)
 *   tools-server --http [PORT]   HTTP POST /rpc (Bearer SERA_TOOLS_TOKEN) + GET /health
 */
loadLocalEnv();
const db = getDb();
runMigrations(db);

const args = process.argv.slice(2);
const httpIdx = args.indexOf("--http");

if (httpIdx !== -1) {
  const port = Number(args[httpIdx + 1] ?? process.env.SERA_TOOLS_PORT ?? 8787);
  const server = createServer((req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (req.method !== "POST" || req.url !== "/rpc") {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not found" }));
      return;
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const { status, body: out } = handleHttpRpc(db, req.headers.authorization, body);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(out));
    });
  });
  server.listen(port, () => logger.info("tools server (http)", { port }));
} else {
  logger.info("tools server (stdio) ready");
  const rl = createInterface({ input: process.stdin });
  rl.on("line", (line) => {
    const out = handleStdioLine(db, line);
    if (out) process.stdout.write(out + "\n");
  });
  rl.on("close", () => db.close());
}
