import { randomUUID } from "node:crypto";
import { EMPTY_PREFS, type ApiKeyRecord, type ClaimCheckRecord, type Conversation, type Message, type Prefs, type UserStore, type Watch, type WatchTrigger } from "./types";

/**
 * In-memory UserStore — the reference implementation for tests and for local dev
 * without Supabase. NOT durable: a restart forgets everything.
 */
const DAY = 86_400_000;

export class MemoryUserStore implements UserStore {
  private users = new Set<string>();
  private prefs = new Map<string, Prefs>();
  private conversations = new Map<string, Conversation & { wallet: string }>();
  private messages: Message[] = [];
  private watches = new Map<string, Watch>();
  private triggers: WatchTrigger[] = [];
  private usage = new Map<string, number>();
  private apiKeys = new Map<string, ApiKeyRecord & { hash: string }>();
  private claimChecks = new Map<string, ClaimCheckRecord & { wallet: string }>();
  private feedback: { wallet: string; messageId: string; rating: 1 | -1; note?: string }[] = [];

  constructor(private readonly now: () => number = Date.now) {}

  async touchUser(wallet: string) { this.users.add(wallet); }

  async getPrefs(wallet: string) { return { ...(this.prefs.get(wallet) ?? EMPTY_PREFS) }; }
  async setPrefs(wallet: string, patch: Partial<Prefs>) {
    const next = { ...(this.prefs.get(wallet) ?? EMPTY_PREFS), ...patch };
    this.prefs.set(wallet, next);
    return { ...next };
  }
  async findWalletByTelegramCode(code: string) {
    for (const [wallet, p] of this.prefs) if (p.telegramLinkCode && p.telegramLinkCode === code) return wallet;
    return null;
  }

  async createConversation(wallet: string, title: string) {
    const t = this.now();
    const c = { id: randomUUID(), wallet, title, createdAt: t, updatedAt: t };
    this.conversations.set(c.id, c);
    return { id: c.id, title, createdAt: t, updatedAt: t };
  }
  async listConversations(wallet: string) {
    return [...this.conversations.values()].filter((c) => c.wallet === wallet).sort((a, b) => b.updatedAt - a.updatedAt).map(({ wallet: _w, ...c }) => c);
  }
  private owns(wallet: string, conversationId: string) { return this.conversations.get(conversationId)?.wallet === wallet; }
  async getMessages(wallet: string, conversationId: string) {
    if (!this.owns(wallet, conversationId)) return null;
    return this.messages.filter((m) => m.conversationId === conversationId);
  }
  async appendMessage(wallet: string, conversationId: string, m: { role: Message["role"]; content: string; meta?: Record<string, unknown> | null }) {
    if (!this.owns(wallet, conversationId)) return null;
    const msg: Message = { id: randomUUID(), conversationId, role: m.role, content: m.content, meta: m.meta ?? null, createdAt: this.now() };
    this.messages.push(msg);
    this.conversations.get(conversationId)!.updatedAt = msg.createdAt;
    return msg;
  }
  async deleteConversation(wallet: string, conversationId: string) {
    if (!this.owns(wallet, conversationId)) return false;
    this.conversations.delete(conversationId);
    this.messages = this.messages.filter((m) => m.conversationId !== conversationId);
    return true;
  }

  async createWatch(wallet: string, w: { text: string; rule: Watch["rule"]; description: string; channel: Watch["channel"] }) {
    const watch: Watch = { id: randomUUID(), wallet, ...w, status: "active", lastState: false, lastEvaluatedAsOf: null, lastFiredAt: null, createdAt: this.now() };
    this.watches.set(watch.id, watch);
    return { ...watch };
  }
  async listWatches(wallet: string) { return [...this.watches.values()].filter((w) => w.wallet === wallet).map((w) => ({ ...w })); }
  async listActiveWatches() { return [...this.watches.values()].filter((w) => w.status === "active").map((w) => ({ ...w })); }
  async updateWatch(wallet: string, watchId: string, patch: { status?: Watch["status"]; channel?: Watch["channel"] }) {
    const w = this.watches.get(watchId);
    if (!w || w.wallet !== wallet) return null;
    Object.assign(w, patch);
    return { ...w };
  }
  async recordEvaluation(watchId: string, e: { state: boolean; asOf: number; firedAt?: number }) {
    const w = this.watches.get(watchId);
    if (!w) return;
    w.lastState = e.state;
    w.lastEvaluatedAsOf = e.asOf;
    if (e.firedAt !== undefined) w.lastFiredAt = e.firedAt;
  }
  async deleteWatch(wallet: string, watchId: string) {
    const w = this.watches.get(watchId);
    if (!w || w.wallet !== wallet) return false;
    this.watches.delete(watchId);
    this.triggers = this.triggers.filter((t) => t.watchId !== watchId);
    return true;
  }
  async recordTrigger(t: { watchId: string; firedAt: number; asOf: number; message: string; delivered: boolean }) {
    this.triggers.push({ id: randomUUID(), ...t });
  }
  async listTriggers(wallet: string, watchId: string) {
    if (this.watches.get(watchId)?.wallet !== wallet) return [];
    return this.triggers.filter((t) => t.watchId === watchId).sort((a, b) => b.firedAt - a.firedAt);
  }

  async bumpUsage(wallet: string, kind: string, day: string) {
    const k = `${wallet}|${kind}|${day}`;
    const n = (this.usage.get(k) ?? 0) + 1;
    this.usage.set(k, n);
    return n;
  }
  async getUsage(wallet: string, kind: string, day: string) { return this.usage.get(`${wallet}|${kind}|${day}`) ?? 0; }

  async createApiKey(wallet: string, k: { label: string; hash: string; prefix: string }) {
    const rec = { id: randomUUID(), wallet, label: k.label, prefix: k.prefix, hash: k.hash, createdAt: this.now(), lastUsedAt: null, revoked: false };
    this.apiKeys.set(rec.id, rec);
    const { hash: _h, ...pub } = rec;
    return pub;
  }
  async listApiKeys(wallet: string) { return [...this.apiKeys.values()].filter((k) => k.wallet === wallet).map(({ hash: _h, ...k }) => k); }
  async findApiKeyByHash(hash: string) {
    const rec = [...this.apiKeys.values()].find((k) => k.hash === hash && !k.revoked);
    if (!rec) return null;
    rec.lastUsedAt = this.now();
    const { hash: _h, ...pub } = rec;
    return pub;
  }
  async revokeApiKey(wallet: string, keyId: string) {
    const k = this.apiKeys.get(keyId);
    if (!k || k.wallet !== wallet) return false;
    k.revoked = true;
    return true;
  }

  async saveClaimCheck(wallet: string, c: { input: string; result: Record<string, unknown> }) {
    const rec = { id: randomUUID(), wallet, input: c.input, result: c.result, createdAt: this.now() };
    this.claimChecks.set(rec.id, rec);
    const { wallet: _w, ...pub } = rec;
    return pub;
  }
  async listClaimChecks(wallet: string) { return [...this.claimChecks.values()].filter((c) => c.wallet === wallet).map(({ wallet: _w, ...c }) => c); }
  async deleteClaimCheck(wallet: string, id: string) {
    if (this.claimChecks.get(id)?.wallet !== wallet) return false;
    return this.claimChecks.delete(id);
  }

  async addFeedback(wallet: string, f: { messageId: string; rating: 1 | -1; note?: string }) { this.feedback.push({ wallet, ...f }); }

  async exportAll(wallet: string) {
    const conversations = await this.listConversations(wallet);
    const watches = await this.listWatches(wallet);
    return {
      wallet,
      prefs: await this.getPrefs(wallet),
      conversations: conversations.map((c) => ({ ...c, messages: this.messages.filter((m) => m.conversationId === c.id) })),
      watches: watches.map((w) => ({ ...w, triggers: this.triggers.filter((t) => t.watchId === w.id) })),
      apiKeys: await this.listApiKeys(wallet),
      claimChecks: await this.listClaimChecks(wallet),
      feedback: this.feedback.filter((f) => f.wallet === wallet).map(({ wallet: _w, ...f }) => f),
    };
  }

  async deleteAll(wallet: string) {
    for (const c of await this.listConversations(wallet)) await this.deleteConversation(wallet, c.id);
    for (const w of await this.listWatches(wallet)) await this.deleteWatch(wallet, w.id);
    for (const [id, k] of this.apiKeys) if (k.wallet === wallet) this.apiKeys.delete(id);
    for (const [id, c] of this.claimChecks) if (c.wallet === wallet) this.claimChecks.delete(id);
    for (const k of [...this.usage.keys()]) if (k.startsWith(`${wallet}|`)) this.usage.delete(k);
    this.feedback = this.feedback.filter((f) => f.wallet !== wallet);
    this.prefs.delete(wallet);
    this.users.delete(wallet);
  }

  async purgeExpired(days: number, now: number = this.now()) {
    const cutoff = now - days * DAY;
    let removed = 0;
    for (const c of [...this.conversations.values()]) {
      if (c.updatedAt < cutoff) {
        await this.deleteConversation(c.wallet, c.id);
        removed++;
      }
    }
    return removed;
  }
}
