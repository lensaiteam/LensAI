import type { DB } from "../capture/db/client";
import { createDerivedDal } from "../factors/derivedDal";
import { createDivergenceDal } from "../divergence/derivedDal";
import { resolveComputedAnchor, type Anchor } from "../tools/handlers";
import { assertNonAdvisory } from "../guardrails/outputFilter";

/**
 * "What changed since I last looked?" — pure arithmetic between two computed
 * anchors (no model call, so it costs nothing from the free pool and cannot
 * hallucinate). The only per-user input is a timestamp; the point-in-time derived
 * tables do the rest.
 */

const MOVER_WINDOW = "365d";
const MOVER_MIN_DELTA = 0.15;

export interface FlagRef { kind: string; subject: string; window_id: string; direction?: string }
export interface RegimeChange { regime_key: string; asset: string; from: string | null; to: string }
export interface Mover { stream: string; source: string; asset: string; from: number; to: number; delta: number }

export interface ChangeSet {
  from: Anchor | null;
  to: Anchor | null;
  flagsOpened: FlagRef[];
  flagsCleared: FlagRef[];
  regimeChanges: RegimeChange[];
  movers: Mover[];
  text: string;
}

const pct = (v: number) => `P${Math.round(v * 100)}`;
const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z");

export function computeChanges(db: DB, opts: { since: number; asOf?: number; assets?: string[] }): ChangeSet {
  const to = resolveComputedAnchor(db, opts.asOf);
  const from = resolveComputedAnchor(db, opts.since);
  const empty = { flagsOpened: [], flagsCleared: [], regimeChanges: [], movers: [] };
  if (!to) return { from, to, ...empty, text: "No factor state has been computed yet." };
  if (!from) return { from, to, ...empty, text: `There is no computed state at or before ${iso(opts.since)} to compare against (latest anchor ${iso(to.as_of)}).` };
  if (from.as_of === to.as_of) {
    return { from, to, ...empty, text: `No new computed state since ${iso(opts.since)} (latest anchor ${iso(to.as_of)}).` };
  }

  const wanted = opts.assets?.length ? new Set(opts.assets.map((a) => a.toUpperCase())) : null;
  const inScope = (asset: string) => !wanted || wanted.has(asset.toUpperCase());

  const div = createDivergenceDal(db);
  // An extreme flag that flips high→low is a different state, not the same flag.
  const dirOf = (f: { detail?: Record<string, unknown> }) => (typeof f.detail?.direction === "string" ? f.detail.direction : undefined);
  const key = (f: FlagRef & { detail?: Record<string, unknown> }) => `${f.kind}|${f.subject}|${f.window_id}|${dirOf(f) ?? ""}`;
  const before = new Map(div.get({ as_of: from.as_of, fired: true }).map((f) => [key(f), f]));
  const after = new Map(div.get({ as_of: to.as_of, fired: true }).map((f) => [key(f), f]));
  const flagScope = (f: FlagRef) => !wanted || [...wanted].some((a) => f.subject.toUpperCase().includes(a));
  const pick = (f: FlagRef & { detail?: Record<string, unknown> }): FlagRef => ({ kind: f.kind, subject: f.subject, window_id: f.window_id, direction: dirOf(f) });
  const flagsOpened = [...after.values()].filter((f) => !before.has(key(f)) && flagScope(f)).map(pick);
  const flagsCleared = [...before.values()].filter((f) => !after.has(key(f)) && flagScope(f)).map(pick);

  const derived = createDerivedDal(db);
  const rKey = (r: { regime_key: string; asset: string }) => `${r.regime_key}|${r.asset}`;
  const rBefore = new Map(derived.getRegimes({ as_of: from.as_of, slot: from.slot }).map((r) => [rKey(r), r.regime_value]));
  const regimeChanges: RegimeChange[] = derived
    .getRegimes({ as_of: to.as_of, slot: to.slot })
    .filter((r) => inScope(r.asset) && rBefore.get(rKey(r)) !== r.regime_value)
    .map((r) => ({ regime_key: r.regime_key, asset: r.asset, from: rBefore.get(rKey(r)) ?? null, to: r.regime_value }));

  const pKey = (p: { stream: string; source: string; asset: string }) => `${p.stream}|${p.source}|${p.asset}`;
  const pBefore = new Map(
    derived.getPercentiles({ as_of: from.as_of, slot: from.slot, window_id: MOVER_WINDOW })
      .filter((p) => p.status === "ok" && p.percentile != null)
      .map((p) => [pKey(p), p.percentile as number]),
  );
  const movers: Mover[] = derived
    .getPercentiles({ as_of: to.as_of, slot: to.slot, window_id: MOVER_WINDOW })
    .filter((p) => p.status === "ok" && p.percentile != null && inScope(p.asset) && pBefore.has(pKey(p)))
    .map((p) => ({ stream: p.stream, source: p.source, asset: p.asset, from: pBefore.get(pKey(p))!, to: p.percentile as number, delta: (p.percentile as number) - pBefore.get(pKey(p))! }))
    .filter((m) => Math.abs(m.delta) >= MOVER_MIN_DELTA)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 8);

  const lines = [`## What changed`, "", `_Between ${iso(from.as_of)} and ${iso(to.as_of)}._`, ""];
  const flagLine = (f: FlagRef) => `${f.subject}${f.window_id ? ` (${f.window_id})` : ""} — ${f.kind.replace(/_/g, " ")}${f.direction ? `, ${f.direction}` : ""}`;
  if (flagsOpened.length) lines.push("**Flags opened**", ...flagsOpened.map((f) => `- ${flagLine(f)}`), "");
  if (flagsCleared.length) lines.push("**Flags cleared**", ...flagsCleared.map((f) => `- ${flagLine(f)}`), "");
  if (regimeChanges.length) lines.push("**Regime shifts**", ...regimeChanges.map((r) => `- ${r.regime_key}[${r.asset}]: ${r.from ?? "—"} → ${r.to}`), "");
  if (movers.length) lines.push(`**Largest percentile moves (${MOVER_WINDOW} window)**`, ...movers.map((m) => `- ${m.stream}/${m.source} ${m.asset}: ${pct(m.from)} → ${pct(m.to)}`), "");
  if (!flagsOpened.length && !flagsCleared.length && !regimeChanges.length && !movers.length) lines.push("No flags opened or cleared, no regime shifts, and no factor moved materially against its own history.", "");
  lines.push("_Measured state only; not financial advice._");
  const text = lines.join("\n");
  assertNonAdvisory(text);

  return { from, to, flagsOpened, flagsCleared, regimeChanges, movers, text };
}
