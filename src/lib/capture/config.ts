/**
 * Capture-layer configuration.
 *
 * Deliberately standalone: it does NOT import the web app's `src/lib/env.ts`,
 * which begins with `import "server-only"` — a module that does not resolve under
 * tsx/vitest (Next injects it only in its own build). The capture daemon and its
 * tests run under tsx/Node, so this reads `process.env` directly while mirroring
 * env.ts's lazy-getter + required/optional pattern.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return v;
}

function optional(name: string, fallback = ""): string {
  const v = process.env[name];
  return v == null || v === "" ? fallback : v;
}

function intOpt(name: string, fallback: number): number {
  const n = parseInt(optional(name, String(fallback)), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const captureConfig = Object.freeze({
  dbPath: () => optional("CAPTURE_DB_PATH", "./data/capture.db"),
  tickMs: () => intOpt("CAPTURE_TICK_MS", 15_000),
  fredApiKey: () => optional("FRED_API_KEY"),
  // Backup targets (README §Backup): prefer litestream, else snapshot dir.
  litestreamReplicaUrl: () => optional("LITESTREAM_REPLICA_URL"),
  backupDir: () => optional("CAPTURE_BACKUP_DIR"),
  // Stubbed institutional sources — presence is checked; never fabricated.
  etfFlowsApiKey: () => optional("ETF_FLOWS_API_KEY"),
  institutionalDepthApiKey: () => optional("INSTITUTIONAL_DEPTH_API_KEY"),
  // Bearer token gating the networked (HTTP) tool server. Empty => HTTP denied.
  seraToolsToken: () => optional("SERA_TOOLS_TOKEN"),
  // Exposed for callers that want a clear error on a genuinely required var.
  requireEnv: required,
});
