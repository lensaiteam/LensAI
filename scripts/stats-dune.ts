import { loadLocalEnv } from "./_bootstrap";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Platform stats for a public dashboard (Dune). Reads the user database with the
 * service role and writes AGGREGATES ONLY: per-day counts, per-ticker counts and
 * running totals. No wallet address, message text, email or key ever leaves
 * this script; wallets are only ever counted, never listed.
 *
 *   npm run stats:dune            writes exports/dune/*.csv
 *   DUNE_API_KEY=... npm run ...  also uploads each CSV as a Dune table
 *                                 (lensai_daily, lensai_tickers, lensai_totals),
 *                                 replacing the previous upload of the same name.
 */
loadLocalEnv();

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (.env.local).");
  process.exit(2);
}
const db: SupabaseClient = createClient(url, key, { auth: { persistSession: false } });

type Row = Record<string, unknown>;

/** Page through a table; PostgREST caps a request at 1000 rows. */
async function all(table: string, columns: string, order = "created_at"): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(columns).order(order, { ascending: true }).range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const day = (v: unknown): string | null => {
  if (v == null) return null;
  const d = typeof v === "number" ? new Date(v) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

interface Daily {
  new_wallets: number;
  active: Set<string>;
  analyses: number;
  followups: number;
  assistant_messages: number;
  model_calls: number;
  cache_hits: number;
  tokens_in: number;
  tokens_out: number;
  web_searches: number;
  agent_conversations: number;
  agent_questions: number;
  agent_answers: number;
  agent_watches_created: number;
  agent_triggers: number;
  agent_claim_checks: number;
  agent_model_calls: number;
  feedback_up: number;
  feedback_down: number;
}
const blank = (): Daily => ({ new_wallets: 0, active: new Set(), analyses: 0, followups: 0, assistant_messages: 0, model_calls: 0, cache_hits: 0, tokens_in: 0, tokens_out: 0, web_searches: 0, agent_conversations: 0, agent_questions: 0, agent_answers: 0, agent_watches_created: 0, agent_triggers: 0, agent_claim_checks: 0, agent_model_calls: 0, feedback_up: 0, feedback_down: 0 });

async function main(): Promise<void> {
  const [users, sessions, messages, usage, aConvs, aMsgs, aWatches, aTriggers, aClaims, aUsage, aFeedback] = await Promise.all([
    all("users", "wallet_address, created_at"),
    all("analysis_sessions", "id, wallet_address, ticker, created_at"),
    all("messages", "session_id, role, created_at"),
    all("usage_log", "wallet_address, cache_hit, input_tokens, output_tokens, web_searches, created_at"),
    all("agent_conversations", "id, wallet_address, created_at"),
    all("agent_messages", "conversation_id, role, created_at"),
    all("agent_watches", "wallet_address, status, created_at"),
    all("agent_watch_triggers", "fired_at, delivered", "fired_at"),
    all("agent_claim_checks", "wallet_address, created_at"),
    all("agent_usage_daily", "wallet_address, kind, day, count", "day"),
    all("agent_feedback", "rating, created_at"),
  ]);

  const days = new Map<string, Daily>();
  const at = (d: string | null): Daily | null => {
    if (!d) return null;
    if (!days.has(d)) days.set(d, blank());
    return days.get(d)!;
  };
  const touch = (d: string | null, wallet: unknown) => {
    const row = at(d);
    if (row && typeof wallet === "string") row.active.add(wallet);
    return row;
  };

  for (const u of users) {
    const r = touch(day(u.created_at), u.wallet_address);
    if (r) r.new_wallets++;
  }
  const sessionWallet = new Map<string, string>();
  const tickers = new Map<string, { analyses: number; wallets: Set<string>; first: string; last: string }>();
  for (const s of sessions) {
    const d = day(s.created_at);
    sessionWallet.set(String(s.id), String(s.wallet_address));
    const r = touch(d, s.wallet_address);
    if (r) r.analyses++;
    const t = String(s.ticker).toUpperCase();
    const rec = tickers.get(t) ?? { analyses: 0, wallets: new Set<string>(), first: d ?? "", last: d ?? "" };
    rec.analyses++;
    rec.wallets.add(String(s.wallet_address));
    if (d && (!rec.first || d < rec.first)) rec.first = d;
    if (d && d > rec.last) rec.last = d;
    tickers.set(t, rec);
  }
  for (const m of messages) {
    const r = touch(day(m.created_at), sessionWallet.get(String(m.session_id)));
    if (!r) continue;
    if (m.role === "user") r.followups++;
    else r.assistant_messages++;
  }
  // Every session opens with one user turn ("Analyze X"); count follow-ups beyond it.
  for (const r of days.values()) r.followups = Math.max(0, r.followups - r.analyses);
  for (const u of usage) {
    const r = touch(day(u.created_at), u.wallet_address);
    if (!r) continue;
    if (u.cache_hit) r.cache_hits++;
    else r.model_calls++;
    r.tokens_in += Number(u.input_tokens ?? 0);
    r.tokens_out += Number(u.output_tokens ?? 0);
    r.web_searches += Number(u.web_searches ?? 0);
  }
  const convWallet = new Map<string, string>();
  for (const c of aConvs) {
    convWallet.set(String(c.id), String(c.wallet_address));
    const r = touch(day(c.created_at), c.wallet_address);
    if (r) r.agent_conversations++;
  }
  for (const m of aMsgs) {
    const r = touch(day(m.created_at), convWallet.get(String(m.conversation_id)));
    if (!r) continue;
    if (m.role === "user") r.agent_questions++;
    else r.agent_answers++;
  }
  for (const w of aWatches) {
    const r = touch(day(w.created_at), w.wallet_address);
    if (r) r.agent_watches_created++;
  }
  for (const t of aTriggers) {
    const r = at(day(Number(t.fired_at)));
    if (r) r.agent_triggers++;
  }
  for (const c of aClaims) {
    const r = touch(day(c.created_at), c.wallet_address);
    if (r) r.agent_claim_checks++;
  }
  for (const u of aUsage) {
    if (u.kind !== "llm") continue;
    const r = touch(String(u.day).slice(0, 10), u.wallet_address);
    if (r) r.agent_model_calls += Number(u.count ?? 0);
  }
  for (const f of aFeedback) {
    const r = at(day(f.created_at));
    if (!r) continue;
    if (Number(f.rating) > 0) r.feedback_up++;
    else r.feedback_down++;
  }

  // ── daily ──
  const sortedDays = [...days.keys()].sort();
  let cumulative = 0;
  const dailyRows = sortedDays.map((d) => {
    const r = days.get(d)!;
    cumulative += r.new_wallets;
    const served = r.model_calls + r.cache_hits;
    return {
      day: d,
      active_wallets: r.active.size,
      new_wallets: r.new_wallets,
      cumulative_wallets: cumulative,
      analyses: r.analyses,
      followups: r.followups,
      assistant_messages: r.assistant_messages,
      model_calls: r.model_calls,
      cache_hits: r.cache_hits,
      cache_hit_rate: served ? Number((r.cache_hits / served).toFixed(4)) : 0,
      tokens_in: r.tokens_in,
      tokens_out: r.tokens_out,
      web_searches: r.web_searches,
      agent_conversations: r.agent_conversations,
      agent_questions: r.agent_questions,
      agent_answers: r.agent_answers,
      agent_watches_created: r.agent_watches_created,
      agent_triggers: r.agent_triggers,
      agent_claim_checks: r.agent_claim_checks,
      agent_model_calls: r.agent_model_calls,
      feedback_up: r.feedback_up,
      feedback_down: r.feedback_down,
    };
  });

  // ── tickers ──
  const tickerRows = [...tickers.entries()]
    .map(([ticker, t]) => ({ ticker, analyses: t.analyses, unique_wallets: t.wallets.size, first_seen: t.first, last_seen: t.last }))
    .sort((a, b) => b.analyses - a.analyses)
    .slice(0, 200);

  // ── totals ──
  const sum = (k: keyof (typeof dailyRows)[number]) => dailyRows.reduce((n, r) => n + Number(r[k]), 0);
  const servedAll = sum("model_calls") + sum("cache_hits");
  const totals = [
    ["wallets", users.length],
    ["analyses", sessions.length],
    ["followup_messages", sum("followups")],
    ["assistant_messages", sum("assistant_messages")],
    ["tickers_covered", tickers.size],
    ["model_calls_v1", sum("model_calls")],
    ["cache_hit_rate_v1", servedAll ? Number((sum("cache_hits") / servedAll).toFixed(4)) : 0],
    ["agent_conversations", aConvs.length],
    ["agent_questions", sum("agent_questions")],
    ["agent_watches", aWatches.length],
    ["agent_watches_active", aWatches.filter((w) => w.status === "active").length],
    ["agent_triggers", aTriggers.length],
    ["agent_claim_checks", aClaims.length],
    ["agent_model_calls", sum("agent_model_calls")],
    ["feedback_up", sum("feedback_up")],
    ["feedback_down", sum("feedback_down")],
    ["first_day", sortedDays[0] ?? ""],
    ["last_day", sortedDays[sortedDays.length - 1] ?? ""],
    ["generated_at", new Date().toISOString()],
  ].map(([metric, value]) => ({ metric, value }));

  const dir = join(process.cwd(), "exports", "dune");
  mkdirSync(dir, { recursive: true });
  const files: [string, string, string][] = [
    ["lensai_daily", csv(dailyRows), "LensAI platform activity per UTC day (aggregates only)."],
    ["lensai_tickers", csv(tickerRows), "LensAI analyses per ticker (aggregates only)."],
    ["lensai_totals", csv(totals), "LensAI running totals (aggregates only)."],
  ];
  for (const [name, data] of files) writeFileSync(join(dir, `${name}.csv`), data);
  console.log(`wrote ${files.map(([n]) => `${n}.csv`).join(", ")} to exports/dune (${dailyRows.length} days, ${tickerRows.length} tickers)`);

  const dune = process.env.DUNE_API_KEY;
  if (!dune) {
    console.log("DUNE_API_KEY not set: upload the CSVs by hand (Dune → Data → Upload data) or set the key to upload automatically.");
    return;
  }
  for (const [table_name, data, description] of files) {
    const res = await fetch("https://api.dune.com/api/v1/table/upload/csv", {
      method: "POST",
      headers: { "X-DUNE-API-KEY": dune, "content-type": "application/json" },
      body: JSON.stringify({ table_name, data, description, is_private: false }),
    });
    const body = await res.text();
    console.log(`${table_name}: ${res.status} ${body.slice(0, 200)}`);
  }
}

function csv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const cell = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n") + "\n";
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
