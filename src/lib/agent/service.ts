import type { DB } from "../capture/db/client";
import { logger } from "../capture/logger";
import { runDivergence } from "../divergence/engine";
import { slotFloor } from "../factors/clock";
import { normalizeAll } from "../factors/normalize";
import { computeRegimes } from "../factors/regimes";
import { persistBrief } from "../narrate/briefs";
import { narrate } from "../narrate/orchestrator";
import { PoolNarrateProvider } from "./ask";
import type { JsonLlm } from "./llm/types";
import { pollTelegramLinks, type Notifier } from "./notify";
import type { UserStore } from "./store/types";
import { runWatches } from "./watch/runner";

/**
 * The agent's background work, as one cycle + a loop runner.
 *   derive cycle: normalize → regimes → divergence at ONE shared anchor (exactly
 *   what `npm run diverge` does), then the shared Market State brief for that
 *   anchor (one model call serves every user), then the watches (zero model calls).
 */

export interface CycleDeps {
  db: DB;
  llm: JsonLlm;
  store: UserStore;
  notifier: Notifier;
  pregenerateMarket: boolean;
}

export async function deriveCycle(deps: CycleDeps, now: number = Date.now()): Promise<{ asOf: number; flags: number; brief: "generated" | "skipped" | "failed"; watchesFired: number }> {
  const { db } = deps;
  const slot = slotFloor(now);
  normalizeAll(db, { asOf: now, slot });
  computeRegimes(db, { asOf: now, slot });
  const flags = runDivergence(db, { asOf: now, slot }).filter((r) => r.fired).length;

  let brief: "generated" | "skipped" | "failed" = "skipped";
  if (deps.pregenerateMarket) {
    try {
      const res = await narrate(db, new PoolNarrateProvider(deps.llm), { surface: "market", asOf: now });
      if (res.kept > 0) {
        persistBrief(db, res, now);
        brief = "generated";
      } else brief = "failed";
    } catch (e) {
      brief = "failed";
      logger.warn("shared market brief not generated", { error: (e as Error).message });
    }
  }

  const watches = await runWatches(db, deps.store, deps.notifier, { now });
  return { asOf: now, flags, brief, watchesFired: watches.fired };
}

export interface Loops { stop: () => void }

export function startLoops(deps: CycleDeps & { deriveIntervalMs: number; retentionDays: number; telegramBotToken?: string }): Loops {
  let stopped = false;
  const timers: NodeJS.Timeout[] = [];
  const every = (ms: number, fn: () => Promise<void>, runNow = false) => {
    let busy = false;
    const tick = async () => {
      if (busy || stopped) return;
      busy = true;
      try { await fn(); } catch (e) { logger.error("agent loop error", { error: (e as Error).message }); }
      busy = false;
    };
    if (runNow) void tick();
    timers.push(setInterval(tick, ms));
  };

  every(deps.deriveIntervalMs, async () => {
    const r = await deriveCycle(deps);
    logger.info("derive cycle", r);
  }, true);

  every(24 * 3_600_000, async () => {
    const n = await deps.store.purgeExpired(deps.retentionDays);
    if (n) logger.info("retention purge", { conversations: n });
  }, true);

  if (deps.telegramBotToken) {
    let offset = 0;
    every(5_000, async () => {
      offset = await pollTelegramLinks(deps.telegramBotToken!, offset, async (code, chatId) => {
        const wallet = await deps.store.findWalletByTelegramCode(code);
        if (!wallet) return false;
        await deps.store.setPrefs(wallet, { telegramChatId: chatId, telegramLinkCode: null });
        return true;
      });
    });
  }

  return { stop: () => { stopped = true; timers.forEach(clearInterval); } };
}
