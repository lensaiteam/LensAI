import type { WatchRule } from "../watch/rule";

/**
 * USER STATE — everything per-user the agent keeps. It lives in Supabase
 * (deletable, exportable), NEVER in the append-only corpus/`briefs` where erasure
 * would be impossible. Identity is the lowercased wallet address; nothing here is
 * ever placed in an LLM prompt. The interface is the seam: MemoryUserStore backs
 * tests/local dev, SupabaseUserStore backs production.
 */

export type Channel = "telegram" | "email";

export interface Prefs {
  /** Token symbols only — no amounts, no balances. */
  watchlist: string[];
  timezone: string | null;
  /** Present only if the user turned that channel on. */
  email: string | null;
  telegramChatId: string | null;
  /** One-time code the user sends to the bot to link their chat. */
  telegramLinkCode: string | null;
  /** Anchor the user last viewed — powers "what changed since I last looked?". */
  lastSeenAsOf: number | null;
}

export const EMPTY_PREFS: Prefs = { watchlist: [], timezone: null, email: null, telegramChatId: null, telegramLinkCode: null, lastSeenAsOf: null };

export interface Conversation { id: string; title: string; createdAt: number; updatedAt: number }

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  /** Assistant turns: the anchor answered at + the claim audit ("show the work"). */
  meta: Record<string, unknown> | null;
  createdAt: number;
}

export type WatchStatus = "active" | "paused";

export interface Watch {
  id: string;
  wallet: string;
  text: string;
  rule: WatchRule;
  description: string;
  channel: Channel;
  status: WatchStatus;
  /** Edge-trigger memory: did the rule hold at the last evaluated anchor? */
  lastState: boolean;
  lastEvaluatedAsOf: number | null;
  lastFiredAt: number | null;
  createdAt: number;
}

export interface WatchTrigger { id: string; watchId: string; firedAt: number; asOf: number; message: string; delivered: boolean }

export interface ApiKeyRecord { id: string; wallet: string; label: string; prefix: string; createdAt: number; lastUsedAt: number | null; revoked: boolean }

export interface ClaimCheckRecord { id: string; input: string; result: Record<string, unknown>; createdAt: number }

export interface UserStore {
  touchUser(wallet: string): Promise<void>;

  getPrefs(wallet: string): Promise<Prefs>;
  setPrefs(wallet: string, patch: Partial<Prefs>): Promise<Prefs>;
  findWalletByTelegramCode(code: string): Promise<string | null>;

  createConversation(wallet: string, title: string): Promise<Conversation>;
  listConversations(wallet: string): Promise<Conversation[]>;
  getMessages(wallet: string, conversationId: string): Promise<Message[] | null>;
  appendMessage(wallet: string, conversationId: string, m: { role: Message["role"]; content: string; meta?: Record<string, unknown> | null }): Promise<Message | null>;
  deleteConversation(wallet: string, conversationId: string): Promise<boolean>;

  createWatch(wallet: string, w: { text: string; rule: WatchRule; description: string; channel: Channel }): Promise<Watch>;
  listWatches(wallet: string): Promise<Watch[]>;
  listActiveWatches(): Promise<Watch[]>;
  updateWatch(wallet: string, watchId: string, patch: { status?: WatchStatus; channel?: Channel }): Promise<Watch | null>;
  recordEvaluation(watchId: string, e: { state: boolean; asOf: number; firedAt?: number }): Promise<void>;
  deleteWatch(wallet: string, watchId: string): Promise<boolean>;
  recordTrigger(t: { watchId: string; firedAt: number; asOf: number; message: string; delivered: boolean }): Promise<void>;
  listTriggers(wallet: string, watchId: string): Promise<WatchTrigger[]>;

  /** Increment today's (UTC) counter for `kind` and return the new count. */
  bumpUsage(wallet: string, kind: string, day: string): Promise<number>;
  getUsage(wallet: string, kind: string, day: string): Promise<number>;

  createApiKey(wallet: string, k: { label: string; hash: string; prefix: string }): Promise<ApiKeyRecord>;
  listApiKeys(wallet: string): Promise<ApiKeyRecord[]>;
  findApiKeyByHash(hash: string): Promise<ApiKeyRecord | null>;
  revokeApiKey(wallet: string, keyId: string): Promise<boolean>;

  saveClaimCheck(wallet: string, c: { input: string; result: Record<string, unknown> }): Promise<ClaimCheckRecord>;
  listClaimChecks(wallet: string): Promise<ClaimCheckRecord[]>;
  deleteClaimCheck(wallet: string, id: string): Promise<boolean>;

  addFeedback(wallet: string, f: { messageId: string; rating: 1 | -1; note?: string }): Promise<void>;

  /** Everything held about a wallet, as plain JSON (data portability). */
  exportAll(wallet: string): Promise<Record<string, unknown>>;
  /** Hard-delete every agent row for a wallet (erasure). */
  deleteAll(wallet: string): Promise<void>;
  /** Retention sweep: drop conversations idle longer than `days`. Returns rows removed. */
  purgeExpired(days: number, now?: number): Promise<number>;
}
