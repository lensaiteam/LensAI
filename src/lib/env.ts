import "server-only";

/**
 * Server-only environment access. We intentionally do NOT throw at module load
 * so the app boots with placeholder credentials (per the chosen setup). Instead
 * each getter throws a clear error only when a feature that needs it is actually
 * invoked. Never import this from a Client Component.
 */

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env.local and fill it in (see README).`,
    );
  }
  return v;
}

function optional(name: string, fallback = ""): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
}

export const env = {
  // LLM provider (swappable — all model access goes through src/lib/ai/provider).
  // Never reference a concrete model/provider name outside that module.
  llmProvider: () => optional("LLM_PROVIDER", "gemini").toLowerCase(),
  analysisModel: () => optional("ANALYSIS_MODEL", "gemini-2.5-flash"),
  chatModel: () => optional("CHAT_MODEL", "gemini-2.5-flash"),

  // Provider API keys (only the active provider's key is required at call time).
  geminiKey: () => required("GEMINI_API_KEY"),
  anthropicKey: () => required("ANTHROPIC_API_KEY"),

  // Supabase (service-role, server-only)
  supabaseUrl: () => required("SUPABASE_URL"),
  supabaseServiceKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),

  // Market data
  coinbaseBase: () => optional("COINBASE_API_BASE", "https://api.exchange.coinbase.com"),
  coingeckoBase: () => optional("FALLBACK_MARKET_DATA_BASE", "https://api.coingecko.com/api/v3"),
  coingeckoKey: () => optional("FALLBACK_MARKET_DATA_API_KEY"),

  // News (optional)
  newsBase: () => optional("NEWS_API_BASE"),
  newsKey: () => optional("NEWS_API_KEY"),

  // App / session
  sessionSecret: () => required("SESSION_JWT_SECRET"),
  appDomain: () => optional("APP_DOMAIN", "localhost:3000"),
  appUrl: () => optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  cronSecret: () => required("CRON_SECRET"),

  // Free-tier size (spec §5.3). Defaults to 2 for real users; override
  // with FREE_TIER_LIMIT locally to test without burning through credits.
  freeTierLimit: () => {
    const n = parseInt(optional("FREE_TIER_LIMIT", "2"), 10);
    return Number.isFinite(n) && n > 0 ? n : 2;
  },

  /** True once the datastore is wired (needed for auth, cache, history). */
  dbConfigured: () =>
    Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),

  isConfigured: () => {
    const providerKey =
      optional("LLM_PROVIDER", "gemini").toLowerCase() === "anthropic"
        ? process.env.ANTHROPIC_API_KEY
        : process.env.GEMINI_API_KEY;
    return Boolean(providerKey && process.env.SUPABASE_URL && process.env.SESSION_JWT_SECRET);
  },
};
