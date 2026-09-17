import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ruleSchema } from "../watch/rule";
import type { ApiKeyRecord, ClaimCheckRecord, Conversation, Message, Prefs, UserStore, Watch, WatchTrigger } from "./types";

/**
 * Supabase-backed UserStore (schema: db/migrations/0002_agent.sql). Service-role
 * client (bypasses RLS), so EVERY query here scopes to the wallet in code — the
 * same Path B discipline as the web app's src/lib/supabase.ts. Engine-side module:
 * no `server-only` import (that only resolves inside Next).
 */

const ms = (iso: string | null): number => (iso ? Date.parse(iso) : 0);

type Row = Record<string, unknown>;

function toPrefs(r: Row | null): Prefs {
  return {
    watchlist: (r?.watchlist as string[] | undefined) ?? [],
    timezone: (r?.timezone as string | null | undefined) ?? null,
    email: (r?.email as string | null | undefined) ?? null,
    telegramChatId: (r?.telegram_chat_id as string | null | undefined) ?? null,
    telegramLinkCode: (r?.telegram_link_code as string | null | undefined) ?? null,
    lastSeenAsOf: r?.last_seen_as_of == null ? null : Number(r.last_seen_as_of),
  };
}

function toWatch(r: Row): Watch {
  return {
    id: r.id as string,
    wallet: r.wallet_address as string,
    text: r.text as string,
    rule: ruleSchema.parse(r.rule),
    description: r.description as string,
    channel: r.channel as Watch["channel"],
    status: r.status as Watch["status"],
    lastState: Boolean(r.last_state),
    lastEvaluatedAsOf: r.last_evaluated_as_of == null ? null : Number(r.last_evaluated_as_of),
    lastFiredAt: r.last_fired_at == null ? null : Number(r.last_fired_at),
    createdAt: ms(r.created_at as string),
  };
}

const toConversation = (r: Row): Conversation => ({ id: r.id as string, title: r.title as string, createdAt: ms(r.created_at as string), updatedAt: ms(r.updated_at as string) });
const toMessage = (r: Row): Message => ({ id: r.id as string, conversationId: r.conversation_id as string, role: r.role as Message["role"], content: r.content as string, meta: (r.meta as Record<string, unknown> | null) ?? null, createdAt: ms(r.created_at as string) });
const toKey = (r: Row): ApiKeyRecord => ({ id: r.id as string, wallet: r.wallet_address as string, label: r.label as string, prefix: r.prefix as string, createdAt: ms(r.created_at as string), lastUsedAt: r.last_used_at ? ms(r.last_used_at as string) : null, revoked: Boolean(r.revoked) });
const toCheck = (r: Row): ClaimCheckRecord => ({ id: r.id as string, input: r.input as string, result: r.result as Record<string, unknown>, createdAt: ms(r.created_at as string) });

export class SupabaseUserStore implements UserStore {
  private readonly db: SupabaseClient;
  constructor(url: string, serviceKey: string) {
    this.db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  }

  async touchUser(wallet: string) {
    await this.db.from("users").upsert({ wallet_address: wallet, last_login_at: new Date().toISOString() }, { onConflict: "wallet_address" });
  }

  async getPrefs(wallet: string) {
    const { data } = await this.db.from("agent_prefs").select("*").eq("wallet_address", wallet).maybeSingle();
    return toPrefs(data as Row | null);
  }
  async setPrefs(wallet: string, patch: Partial<Prefs>) {
    const row: Row = { wallet_address: wallet, updated_at: new Date().toISOString() };
    if (patch.watchlist !== undefined) row.watchlist = patch.watchlist;
    if (patch.timezone !== undefined) row.timezone = patch.timezone;
    if (patch.email !== undefined) row.email = patch.email;
    if (patch.telegramChatId !== undefined) row.telegram_chat_id = patch.telegramChatId;
    if (patch.telegramLinkCode !== undefined) row.telegram_link_code = patch.telegramLinkCode;
    if (patch.lastSeenAsOf !== undefined) row.last_seen_as_of = patch.lastSeenAsOf;
    const { data, error } = await this.db.from("agent_prefs").upsert(row, { onConflict: "wallet_address" }).select("*").single();
    if (error) throw new Error(`setPrefs: ${error.message}`);
    return toPrefs(data as Row);
  }
  async findWalletByTelegramCode(code: string) {
    const { data } = await this.db.from("agent_prefs").select("wallet_address").eq("telegram_link_code", code).maybeSingle();
    return (data?.wallet_address as string | undefined) ?? null;
  }

  async createConversation(wallet: string, title: string) {
    const { data, error } = await this.db.from("agent_conversations").insert({ wallet_address: wallet, title }).select("*").single();
    if (error) throw new Error(`createConversation: ${error.message}`);
    return toConversation(data as Row);
  }
  async listConversations(wallet: string) {
    const { data } = await this.db.from("agent_conversations").select("*").eq("wallet_address", wallet).order("updated_at", { ascending: false }).limit(100);
    return ((data ?? []) as Row[]).map(toConversation);
  }
  private async owns(wallet: string, conversationId: string): Promise<boolean> {
    const { data } = await this.db.from("agent_conversations").select("id").eq("id", conversationId).eq("wallet_address", wallet).maybeSingle();
    return !!data;
  }
  async getMessages(wallet: string, conversationId: string) {
    if (!(await this.owns(wallet, conversationId))) return null;
    const { data } = await this.db.from("agent_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
    return ((data ?? []) as Row[]).map(toMessage);
  }
  async appendMessage(wallet: string, conversationId: string, m: { role: Message["role"]; content: string; meta?: Record<string, unknown> | null }) {
    if (!(await this.owns(wallet, conversationId))) return null;
    const { data, error } = await this.db.from("agent_messages").insert({ conversation_id: conversationId, role: m.role, content: m.content, meta: m.meta ?? null }).select("*").single();
    if (error) throw new Error(`appendMessage: ${error.message}`);
    await this.db.from("agent_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).eq("wallet_address", wallet);
    return toMessage(data as Row);
  }
  async deleteConversation(wallet: string, conversationId: string) {
    const { data } = await this.db.from("agent_conversations").delete().eq("id", conversationId).eq("wallet_address", wallet).select("id");
    return (data?.length ?? 0) > 0;
  }

  async createWatch(wallet: string, w: { text: string; rule: Watch["rule"]; description: string; channel: Watch["channel"] }) {
    const { data, error } = await this.db.from("agent_watches").insert({ wallet_address: wallet, text: w.text, rule: w.rule, description: w.description, channel: w.channel }).select("*").single();
    if (error) throw new Error(`createWatch: ${error.message}`);
    return toWatch(data as Row);
  }
  async listWatches(wallet: string) {
    const { data } = await this.db.from("agent_watches").select("*").eq("wallet_address", wallet).order("created_at", { ascending: false });
    return ((data ?? []) as Row[]).map(toWatch);
  }
  async listActiveWatches() {
    const { data } = await this.db.from("agent_watches").select("*").eq("status", "active");
    return ((data ?? []) as Row[]).map(toWatch);
  }
  async updateWatch(wallet: string, watchId: string, patch: { status?: Watch["status"]; channel?: Watch["channel"] }) {
    const { data } = await this.db.from("agent_watches").update(patch).eq("id", watchId).eq("wallet_address", wallet).select("*").maybeSingle();
    return data ? toWatch(data as Row) : null;
  }
  async recordEvaluation(watchId: string, e: { state: boolean; asOf: number; firedAt?: number }) {
    const row: Row = { last_state: e.state, last_evaluated_as_of: e.asOf };
    if (e.firedAt !== undefined) row.last_fired_at = e.firedAt;
    await this.db.from("agent_watches").update(row).eq("id", watchId);
  }
  async deleteWatch(wallet: string, watchId: string) {
    const { data } = await this.db.from("agent_watches").delete().eq("id", watchId).eq("wallet_address", wallet).select("id");
    return (data?.length ?? 0) > 0;
  }
  async recordTrigger(t: { watchId: string; firedAt: number; asOf: number; message: string; delivered: boolean }) {
    await this.db.from("agent_watch_triggers").insert({ watch_id: t.watchId, fired_at: t.firedAt, as_of: t.asOf, message: t.message, delivered: t.delivered });
  }
  async listTriggers(wallet: string, watchId: string) {
    const { data: w } = await this.db.from("agent_watches").select("id").eq("id", watchId).eq("wallet_address", wallet).maybeSingle();
    if (!w) return [];
    const { data } = await this.db.from("agent_watch_triggers").select("*").eq("watch_id", watchId).order("fired_at", { ascending: false }).limit(100);
    return ((data ?? []) as Row[]).map((r): WatchTrigger => ({ id: r.id as string, watchId: r.watch_id as string, firedAt: Number(r.fired_at), asOf: Number(r.as_of), message: r.message as string, delivered: Boolean(r.delivered) }));
  }

  async bumpUsage(wallet: string, kind: string, day: string) {
    const { data, error } = await this.db.rpc("bump_agent_usage", { p_wallet: wallet, p_kind: kind, p_day: day });
    if (error) throw new Error(`bumpUsage: ${error.message}`);
    return Number(data);
  }
  async getUsage(wallet: string, kind: string, day: string) {
    const { data } = await this.db.from("agent_usage_daily").select("count").eq("wallet_address", wallet).eq("kind", kind).eq("day", day).maybeSingle();
    return Number(data?.count ?? 0);
  }

  async createApiKey(wallet: string, k: { label: string; hash: string; prefix: string }) {
    const { data, error } = await this.db.from("agent_api_keys").insert({ wallet_address: wallet, label: k.label, prefix: k.prefix, key_hash: k.hash }).select("*").single();
    if (error) throw new Error(`createApiKey: ${error.message}`);
    return toKey(data as Row);
  }
  async listApiKeys(wallet: string) {
    const { data } = await this.db.from("agent_api_keys").select("*").eq("wallet_address", wallet).order("created_at", { ascending: false });
    return ((data ?? []) as Row[]).map(toKey);
  }
  async findApiKeyByHash(hash: string) {
    const { data } = await this.db.from("agent_api_keys").select("*").eq("key_hash", hash).eq("revoked", false).maybeSingle();
    if (!data) return null;
    await this.db.from("agent_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", (data as Row).id as string);
    return toKey(data as Row);
  }
  async revokeApiKey(wallet: string, keyId: string) {
    const { data } = await this.db.from("agent_api_keys").update({ revoked: true }).eq("id", keyId).eq("wallet_address", wallet).select("id");
    return (data?.length ?? 0) > 0;
  }

  async saveClaimCheck(wallet: string, c: { input: string; result: Record<string, unknown> }) {
    const { data, error } = await this.db.from("agent_claim_checks").insert({ wallet_address: wallet, input: c.input, result: c.result }).select("*").single();
    if (error) throw new Error(`saveClaimCheck: ${error.message}`);
    return toCheck(data as Row);
  }
  async listClaimChecks(wallet: string) {
    const { data } = await this.db.from("agent_claim_checks").select("*").eq("wallet_address", wallet).order("created_at", { ascending: false }).limit(100);
    return ((data ?? []) as Row[]).map(toCheck);
  }
  async deleteClaimCheck(wallet: string, id: string) {
    const { data } = await this.db.from("agent_claim_checks").delete().eq("id", id).eq("wallet_address", wallet).select("id");
    return (data?.length ?? 0) > 0;
  }

  async addFeedback(wallet: string, f: { messageId: string; rating: 1 | -1; note?: string }) {
    await this.db.from("agent_feedback").insert({ wallet_address: wallet, message_id: f.messageId, rating: f.rating, note: f.note ?? null });
  }

  async exportAll(wallet: string) {
    const conversations = await this.listConversations(wallet);
    const watches = await this.listWatches(wallet);
    const { data: feedback } = await this.db.from("agent_feedback").select("message_id, rating, note, created_at").eq("wallet_address", wallet);
    return {
      wallet,
      prefs: await this.getPrefs(wallet),
      conversations: await Promise.all(conversations.map(async (c) => ({ ...c, messages: (await this.getMessages(wallet, c.id)) ?? [] }))),
      watches: await Promise.all(watches.map(async (w) => ({ ...w, triggers: await this.listTriggers(wallet, w.id) }))),
      apiKeys: await this.listApiKeys(wallet),
      claimChecks: await this.listClaimChecks(wallet),
      feedback: feedback ?? [],
    };
  }

  async deleteAll(wallet: string) {
    // Children cascade from their parents (messages, triggers).
    for (const table of ["agent_conversations", "agent_watches", "agent_api_keys", "agent_claim_checks", "agent_feedback", "agent_usage_daily", "agent_prefs"]) {
      const { error } = await this.db.from(table).delete().eq("wallet_address", wallet);
      if (error) throw new Error(`deleteAll(${table}): ${error.message}`);
    }
  }

  async purgeExpired(days: number) {
    const { data, error } = await this.db.rpc("purge_agent_conversations", { p_days: days });
    if (error) throw new Error(`purgeExpired: ${error.message}`);
    return Number(data ?? 0);
  }
}
