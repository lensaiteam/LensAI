import type { DB } from "../../capture/db/client";
import { logger } from "../../capture/logger";
import { checkNonAdvisory } from "../../guardrails/outputFilter";
import { resolveComputedAnchor } from "../../tools/handlers";
import type { Notifier } from "../notify";
import type { UserStore, Watch } from "../store/types";
import { evaluateRule, type Evaluation } from "./evaluate";

/**
 * Evaluate every active watch at the latest computed anchor. Zero model calls.
 *   - each (watch, anchor) is evaluated once (lastEvaluatedAsOf);
 *   - EDGE-triggered: fires on the false→true transition, not while a state persists;
 *   - cooldown bounds re-fires if a state flaps;
 *   - the alert body is deterministic measured evidence, guardrail-checked.
 * The trigger log lives in the user store (deletable) — never in the corpus.
 */

const HOUR = 3_600_000;

export function alertBody(w: Watch, e: Evaluation): string {
  return [
    w.description,
    "",
    "Measured at this anchor:",
    ...e.conditions.map((c) => `• ${c.evidence}`),
    "",
    `As of ${new Date(e.anchor.as_of).toISOString()}. Percentiles are against each stream's own history.`,
    "This describes market state. It is not financial advice.",
  ].join("\n");
}

export interface RunSummary { anchor: number | null; evaluated: number; fired: number; delivered: number }

export async function runWatches(db: DB, store: UserStore, notifier: Notifier, opts: { now?: number } = {}): Promise<RunSummary> {
  const now = opts.now ?? Date.now();
  const anchor = resolveComputedAnchor(db, now);
  if (!anchor) return { anchor: null, evaluated: 0, fired: 0, delivered: 0 };

  let evaluated = 0;
  let fired = 0;
  let delivered = 0;
  for (const w of await store.listActiveWatches()) {
    if (w.lastEvaluatedAsOf !== null && w.lastEvaluatedAsOf >= anchor.as_of) continue;
    evaluated++;
    try {
      const e = evaluateRule(db, w.rule, anchor);
      const rising = e.fired && !w.lastState;
      const cooled = w.lastFiredAt === null || now - w.lastFiredAt >= w.rule.cooldown_hours * HOUR;
      if (!(rising && cooled)) {
        await store.recordEvaluation(w.id, { state: e.fired, asOf: anchor.as_of });
        continue;
      }
      const body = alertBody(w, e);
      if (!checkNonAdvisory(body).ok) {
        // Fail-closed: an alert that reads as advice is never sent.
        logger.error("watch alert blocked by non-advisory guardrail", { watch: w.id });
        await store.recordEvaluation(w.id, { state: e.fired, asOf: anchor.as_of });
        continue;
      }
      fired++;
      const prefs = await store.getPrefs(w.wallet);
      const ok = await notifier.send(w.channel, prefs, { title: "LensAI watch — condition met", body });
      if (ok) delivered++;
      await store.recordTrigger({ watchId: w.id, firedAt: now, asOf: anchor.as_of, message: body, delivered: ok });
      await store.recordEvaluation(w.id, { state: true, asOf: anchor.as_of, firedAt: now });
    } catch (err) {
      logger.warn("watch evaluation failed", { watch: w.id, error: (err as Error).message });
    }
  }
  return { anchor: anchor.as_of, evaluated, fired, delivered };
}
