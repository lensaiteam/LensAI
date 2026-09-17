import { logger } from "../capture/logger";
import type { Channel, Prefs } from "./store/types";

/**
 * Alert delivery. Channels are plain HTTPS calls (no SDK deps): Telegram Bot API
 * and Resend. A channel with no credentials is simply unavailable. Fail-soft:
 * delivery returns false rather than throwing — the trigger is still recorded.
 */

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface Notifier {
  send(channel: Channel, prefs: Prefs, alert: { title: string; body: string }): Promise<boolean>;
}

export class HttpNotifier implements Notifier {
  constructor(
    private readonly cfg: { telegramBotToken?: string; resendApiKey?: string; alertFromEmail?: string },
    private readonly fetchFn: FetchLike = fetch as unknown as FetchLike,
  ) {}

  async send(channel: Channel, prefs: Prefs, alert: { title: string; body: string }): Promise<boolean> {
    try {
      if (channel === "telegram") {
        if (!this.cfg.telegramBotToken || !prefs.telegramChatId) return false;
        const res = await this.fetchFn(`https://api.telegram.org/bot${this.cfg.telegramBotToken}/sendMessage`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: prefs.telegramChatId, text: `${alert.title}\n\n${alert.body}`, disable_web_page_preview: true }),
        });
        return res.ok;
      }
      if (!this.cfg.resendApiKey || !this.cfg.alertFromEmail || !prefs.email) return false;
      const res = await this.fetchFn("https://api.resend.com/emails", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.cfg.resendApiKey}` },
        body: JSON.stringify({ from: this.cfg.alertFromEmail, to: [prefs.email], subject: alert.title, text: alert.body }),
      });
      return res.ok;
    } catch (e) {
      logger.warn("alert delivery failed", { channel, error: (e as Error).message });
      return false;
    }
  }
}

/** Records alerts instead of sending — tests and local dev. */
export class MemoryNotifier implements Notifier {
  public sent: { channel: Channel; title: string; body: string }[] = [];
  constructor(private readonly ok = true) {}
  async send(channel: Channel, _prefs: Prefs, alert: { title: string; body: string }): Promise<boolean> {
    this.sent.push({ channel, ...alert });
    return this.ok;
  }
}

/**
 * Telegram linking: the user gets a one-time code, sends `/start <code>` to the
 * bot, and the poller binds that chat to their account. Long-poll `getUpdates`
 * (no public webhook needed). Returns the next update offset.
 */
export async function pollTelegramLinks(
  botToken: string,
  offset: number,
  bind: (code: string, chatId: string) => Promise<boolean>,
  fetchFn: FetchLike = fetch as unknown as FetchLike,
): Promise<number> {
  const res = await fetchFn(`https://api.telegram.org/bot${botToken}/getUpdates`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ offset, timeout: 0, allowed_updates: ["message"] }),
  });
  if (!res.ok) return offset;
  const data = JSON.parse(await res.text()) as { result?: { update_id: number; message?: { text?: string; chat?: { id: number } } }[] };
  let next = offset;
  for (const u of data.result ?? []) {
    next = Math.max(next, u.update_id + 1);
    const m = u.message?.text?.match(/^\/start\s+([A-Za-z0-9_-]{6,64})\s*$/);
    const chatId = u.message?.chat?.id;
    if (!m || chatId == null) continue;
    const ok = await bind(m[1], String(chatId));
    await fetchFn(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: ok ? "Linked. LensAI watch alerts will arrive here. They describe market state — never what to do about it." : "That link code is not valid or has expired. Generate a new one from the desk." }),
    });
  }
  return next;
}
