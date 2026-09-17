import type { DB } from "../../capture/db/client";
import { createDerivedDal } from "../../factors/derivedDal";
import { createDivergenceDal } from "../../divergence/derivedDal";
import type { Anchor } from "../../tools/handlers";
import { describeCondition, type Condition, type WatchRule } from "./rule";

/**
 * Evaluate a watch rule at a computed anchor. Pure reads over the derived tables —
 * no model, no network. Fail-closed: a condition whose data is missing or
 * insufficient is NOT met (a watch never fires on absent data).
 */

export interface ConditionResult {
  met: boolean;
  description: string;
  /** Measured evidence, citable: e.g. "funding_rate/binance BTC 365d = P97". */
  evidence: string;
}

export interface Evaluation {
  fired: boolean;
  anchor: Anchor;
  conditions: ConditionResult[];
}

const pct = (v: number) => `P${Math.round(v * 100)}`;

function evalCondition(db: DB, c: Condition, anchor: Anchor): ConditionResult {
  const description = describeCondition(c);
  const derived = createDerivedDal(db);

  if (c.type === "percentile") {
    const rows = derived
      .getPercentiles({ stream: c.stream, asset: c.asset, as_of: anchor.as_of, slot: anchor.slot, window_id: c.window })
      .filter((p) => (!c.source || p.source === c.source) && p.status === "ok" && p.percentile != null);
    if (!rows.length) return { met: false, description, evidence: `no ${c.window} percentile for ${c.stream} ${c.asset} at this anchor` };
    // With no source pinned, ANY source meeting the threshold satisfies the condition.
    const hit = rows.find((p) => (c.op === "gte" ? (p.percentile as number) >= c.value : (p.percentile as number) <= c.value));
    const shown = hit ?? rows[0];
    return { met: !!hit, description, evidence: `${shown.stream}/${shown.source} ${shown.asset} ${c.window} = ${pct(shown.percentile as number)}` };
  }

  if (c.type === "regime") {
    const rows = derived.getRegimes({ regime_key: c.regime_key, as_of: anchor.as_of, slot: anchor.slot }).filter((r) => !c.asset || r.asset === c.asset);
    if (!rows.length) return { met: false, description, evidence: `no ${c.regime_key} regime at this anchor` };
    const hit = rows.find((r) => r.regime_value === c.equals);
    const shown = hit ?? rows[0];
    return { met: !!hit, description, evidence: `${shown.regime_key}[${shown.asset}] = ${shown.regime_value}` };
  }

  const fired = createDivergenceDal(db).get({ as_of: anchor.as_of, fired: true });
  if (c.type === "divergence") {
    const needle = c.subject_includes?.toUpperCase();
    const hit = fired.find((f) => f.kind !== "structural_signature" && (!c.kind || f.kind === c.kind) && (!needle || f.subject.toUpperCase().includes(needle)));
    return { met: !!hit, description, evidence: hit ? `${hit.kind} fired on ${hit.subject}${hit.window_id ? ` (${hit.window_id})` : ""}` : "no matching flag fired" };
  }

  const hit = fired.find((f) => f.kind === "structural_signature" && f.subject.startsWith(`${c.key}/`) && (!c.asset || f.subject === `${c.key}/${c.asset}`));
  return { met: !!hit, description, evidence: hit ? `${hit.subject} fired` : `${c.key} not fired` };
}

export function evaluateRule(db: DB, rule: WatchRule, anchor: Anchor): Evaluation {
  const conditions = rule.all.map((c) => evalCondition(db, c, anchor));
  return { fired: conditions.every((c) => c.met), anchor, conditions };
}
