/**
 * Agent-layer configuration. Standalone like capture/config.ts (the agent service
 * runs under tsx/Node, where the web app's `server-only` env module does not
 * resolve). Lazy getters: nothing throws until a feature that needs it is used.
 */

function optional(name: string, fallback = ""): string {
  const v = process.env[name];
  return v == null || v === "" ? fallback : v;
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env ${name}. See .env.example (AGENT section).`);
  return v;
}

function intOpt(name: string, fallback: number): number {
  const n = parseInt(optional(name, String(fallback)), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const agentConfig = Object.freeze({
  port: () => intOpt("PORT", intOpt("AGENT_PORT", 8788)),
  /** Shared with the web app: verifies the short-lived agent token it mints. */
  sessionSecret: () => required("SESSION_JWT_SECRET"),
  /** Browser origin allowed to call the service (CORS). Empty => no CORS headers. */
  allowedOrigin: () => optional("AGENT_ALLOWED_ORIGIN"),
  /** Per-user ad-hoc LLM questions per UTC day (the free pool is finite). */
  dailyAskLimit: () => intOpt("AGENT_DAILY_ASK_LIMIT", 25),
  /** Per-user requests per minute (in-memory; no IPs are stored). */
  perMinuteLimit: () => intOpt("AGENT_PER_MINUTE_LIMIT", 20),
  maxWatchesPerUser: () => intOpt("AGENT_MAX_WATCHES", 10),
  conversationRetentionDays: () => intOpt("AGENT_RETENTION_DAYS", 90),
  /** Derive loop (normalize → regimes → divergence → brief → watches) cadence.
   *  Default = the canonical hourly grid: one anchor, one shared brief, per hour. */
  deriveIntervalMs: () => intOpt("AGENT_DERIVE_INTERVAL_MS", 60 * 60_000),

  // User-state store (Supabase). Absent => in-memory store (dev only; not durable).
  supabaseUrl: () => optional("SUPABASE_URL"),
  supabaseServiceKey: () => optional("SUPABASE_SERVICE_ROLE_KEY"),

  // Alert channels — each is optional; an unset channel is simply unavailable.
  telegramBotToken: () => optional("TELEGRAM_BOT_TOKEN"),
  telegramBotName: () => optional("TELEGRAM_BOT_NAME"),
  resendApiKey: () => optional("RESEND_API_KEY"),
  alertFromEmail: () => optional("ALERT_FROM_EMAIL"),

  env: (name: string) => optional(name),
});
