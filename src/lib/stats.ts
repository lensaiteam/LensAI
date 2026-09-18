import "server-only";
import { supabaseAdmin } from "./supabase";

/**
 * Platform statistics for the public analytics page: aggregates only, computed
 * inside Postgres by `platform_stats()` (db/migrations/0003_stats.sql). Wallets are
 * counted, never listed. Returns null when the function is not installed or the
 * database is unreachable, so the page can say so instead of inventing numbers.
 */

export interface DailyStat {
  day: string;
  active_wallets: number;
  new_wallets: number;
  analyses: number;
  followups: number;
  model_calls: number;
  cache_hits: number;
  agent_conversations: number;
  agent_questions: number;
  agent_watches_created: number;
  agent_triggers: number;
  agent_claim_checks: number;
}

export interface TickerStat { ticker: string; analyses: number; unique_wallets: number }

export interface Totals {
  wallets: number;
  analyses: number;
  followups: number;
  tickers: number;
  model_calls: number;
  cache_hits: number;
  agent_conversations: number;
  agent_questions: number;
  agent_watches: number;
  agent_watches_active: number;
  agent_triggers: number;
  agent_claim_checks: number;
  feedback_up: number;
  feedback_down: number;
}

export interface PlatformStats { generated_at: string; daily: DailyStat[]; tickers: TickerStat[]; totals: Totals }

/**
 * Development only: build the same shape from the CSVs `npm run stats:dune` wrote,
 * so the page can be styled before the database function is installed. Never
 * reachable in production.
 */
export async function getPlatformStatsFromExports(): Promise<PlatformStats | null> {
  if (process.env.NODE_ENV !== "development") return null;
  try {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const parse = (name: string): Record<string, string>[] => {
      const lines = readFileSync(join(process.cwd(), "exports", "dune", `${name}.csv`), "utf8").trim().split("\n");
      const cols = lines[0].split(",");
      return lines.slice(1).map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
    };
    const num = (v: string | undefined) => Number(v ?? 0);
    const daily: DailyStat[] = parse("lensai_daily").map((r) => ({
      day: r.day,
      active_wallets: num(r.active_wallets),
      new_wallets: num(r.new_wallets),
      analyses: num(r.analyses),
      followups: num(r.followups),
      model_calls: num(r.model_calls),
      cache_hits: num(r.cache_hits),
      agent_conversations: num(r.agent_conversations),
      agent_questions: num(r.agent_questions),
      agent_watches_created: num(r.agent_watches_created),
      agent_triggers: num(r.agent_triggers),
      agent_claim_checks: num(r.agent_claim_checks),
    }));
    const tickers: TickerStat[] = parse("lensai_tickers").slice(0, 12).map((r) => ({ ticker: r.ticker, analyses: num(r.analyses), unique_wallets: num(r.unique_wallets) }));
    const t = Object.fromEntries(parse("lensai_totals").map((r) => [r.metric, r.value]));
    const sum = (k: keyof DailyStat) => daily.reduce((n, d) => n + Number(d[k]), 0);
    const totals: Totals = {
      wallets: num(t.wallets),
      analyses: num(t.analyses),
      followups: num(t.followup_messages),
      tickers: num(t.tickers_covered),
      model_calls: num(t.model_calls_v1),
      cache_hits: sum("cache_hits"),
      agent_conversations: num(t.agent_conversations),
      agent_questions: num(t.agent_questions),
      agent_watches: num(t.agent_watches),
      agent_watches_active: num(t.agent_watches_active),
      agent_triggers: num(t.agent_triggers),
      agent_claim_checks: num(t.agent_claim_checks),
      feedback_up: num(t.feedback_up),
      feedback_down: num(t.feedback_down),
    };
    return { generated_at: String(t.generated_at ?? new Date().toISOString()), daily, tickers, totals };
  } catch {
    return null;
  }
}

export async function getPlatformStats(): Promise<PlatformStats | null> {
  try {
    const { data, error } = await supabaseAdmin().rpc("platform_stats");
    if (error || !data || typeof data !== "object") return null;
    const s = data as PlatformStats;
    if (!Array.isArray(s.daily) || !s.totals) return null;
    return s;
  } catch {
    return null;
  }
}
