"use client";
import { useCallback, useEffect, useState } from "react";
import { agentFetch, type CompileResult, type Prefs, type Watch, type WatchRule, type WatchTrigger } from "@/lib/agentClient";
import { Btn, Err, Placard, Sheet, Tag, utc } from "./bits";

const EXAMPLES = [
  "tell me when BTC funding is extreme but basis isn't following",
  "alert me if market depth for ETH drops to a historical low",
  "when the market turns leverage-led",
];

type Cond = WatchRule["all"][number];

function describe(c: Cond): [string, string] {
  switch (c.type) {
    case "percentile":
      return ["percentile", `${c.stream}${c.source ? "/" + c.source : ""} ${c.asset} ${c.op === "gte" ? "≥" : "≤"} P${Math.round(c.value * 100)} (${c.window})`];
    case "regime":
      return ["regime", `${c.regime_key}${c.asset ? "[" + c.asset + "]" : ""} = ${c.equals}`];
    case "divergence":
      return ["divergence", `${c.kind ? c.kind.replace("_", " ") : "any flag"}${c.subject_includes ? " on " + c.subject_includes : ""}`];
    case "signature":
      return ["signature", `${c.key.replace("_", " ")}${c.asset ? " [" + c.asset + "]" : ""}`];
  }
}

export function WatchesView({ onSpent, goAccount }: { onSpent: () => void; goAccount: () => void }) {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [text, setText] = useState("");
  const [compiled, setCompiled] = useState<CompileResult | null>(null);
  const [channel, setChannel] = useState<"telegram" | "email">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [triggers, setTriggers] = useState<Record<string, WatchTrigger[] | undefined>>({});

  const load = useCallback(async () => {
    try {
      const [w, p] = await Promise.all([agentFetch<{ watches: Watch[] }>("/v1/watches"), agentFetch<{ prefs: Prefs }>("/v1/prefs")]);
      setWatches(w.watches);
      setPrefs(p.prefs);
      if (p.prefs.telegramChatId && !p.prefs.email) setChannel("telegram");
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const compile = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setCompiled(null);
    try {
      setCompiled(await agentFetch<CompileResult>("/v1/watches/compile", { method: "POST", body: { text: text.trim() } }));
      onSpent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const create = async () => {
    if (!compiled || !compiled.ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      await agentFetch("/v1/watches", { method: "POST", body: { text: text.trim(), rule: compiled.rule, channel } });
      setText("");
      setCompiled(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (w: Watch) => {
    try {
      const r = await agentFetch<{ watch: Watch }>(`/v1/watches/${w.id}`, { method: "PATCH", body: { status: w.status === "active" ? "paused" : "active" } });
      setWatches((ws) => ws.map((x) => (x.id === w.id ? r.watch : x)));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const remove = async (w: Watch) => {
    try {
      await agentFetch(`/v1/watches/${w.id}`, { method: "DELETE" });
      setWatches((ws) => ws.filter((x) => x.id !== w.id));
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const showTriggers = async (w: Watch) => {
    if (triggers[w.id]) {
      setTriggers((t) => ({ ...t, [w.id]: undefined }));
      return;
    }
    try {
      const r = await agentFetch<{ triggers: WatchTrigger[] }>(`/v1/watches/${w.id}/triggers`);
      setTriggers((t) => ({ ...t, [w.id]: r.triggers }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const canTelegram = !!prefs?.telegramChatId;
  const canEmail = !!prefs?.email;

  return (
    <div className="dk-wrap">
      <div className="dk-top">
        <div>
          <span className="dk-kick">A06 / Watches</span>
          <h1 className="dk-title">
            Leave it <em>watching.</em>
          </h1>
        </div>
      </div>

      <div className="dk-stack">
        <Sheet marks>
          <Placard items={[["step 1", "describe the state"], ["step 2", "confirm the rule"], ["step 3", "choose a channel"]]} />
          <p className="dk-note">
            Describe a market state in plain words. A small model translates it into a rule once, the desk echoes the rule back in exact terms,
            and you confirm. From then on the watch is arithmetic, evaluated at every anchor and fired on the change from false to true. It
            describes state only; price levels and instructions are refused.
          </p>
          <textarea
            className="dk-ta"
            style={{ marginTop: 14 }}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setCompiled(null);
            }}
            placeholder="e.g. tell me when BTC funding is extreme but basis isn't following"
            maxLength={500}
            aria-label="Watch description"
          />
          <div className="dk-row between">
            <div className="dk-chips">
              {EXAMPLES.map((x) => (
                <button key={x} type="button" className="dk-chip" onClick={() => { setText(x); setCompiled(null); }}>
                  {x}
                </button>
              ))}
            </div>
            <Btn onClick={compile} disabled={busy || text.trim().length < 3}>{busy && !compiled ? "Compiling" : "Compile"}</Btn>
          </div>

          {compiled && !compiled.ok && <Err>The desk cannot express that as a watch: {compiled.reason}</Err>}
          {compiled && compiled.ok && (
            <div style={{ marginTop: 18 }}>
              <Placard items={[["rule", "read it back"], ["cooldown", `${compiled.rule.cooldown_hours}h`], ["conditions", `${compiled.rule.all.length}, all must hold`]]} />
              {compiled.rule.all.map((c, i) => {
                const [k, v] = describe(c);
                return (
                  <div key={i} className="dk-cond">
                    <span>{k}</span>
                    <span>{v}</span>
                  </div>
                );
              })}
              <p className="dk-note" style={{ marginTop: 12 }}>{compiled.description}</p>
              <div className="dk-row between" style={{ marginTop: 14 }}>
                <div className="dk-row">
                  <div className="dk-seg" role="group" aria-label="Alert channel">
                    <button type="button" className={channel === "email" ? "on" : ""} onClick={() => setChannel("email")} disabled={!canEmail}>email</button>
                    <button type="button" className={channel === "telegram" ? "on" : ""} onClick={() => setChannel("telegram")} disabled={!canTelegram}>telegram</button>
                  </div>
                  {!canEmail && !canTelegram && (
                    <span className="dk-note">
                      No alert channel yet. <button type="button" className="dk-link" onClick={goAccount}>Add an email or link Telegram</button> first.
                    </span>
                  )}
                </div>
                <Btn onClick={create} disabled={busy || (channel === "email" ? !canEmail : !canTelegram)}>Confirm and watch</Btn>
              </div>
            </div>
          )}
          <Err>{error}</Err>
        </Sheet>

        <Sheet>
          <Placard items={[["standing", `${watches.length} ${watches.length === 1 ? "watch" : "watches"}`], ["active", String(watches.filter((w) => w.status === "active").length)]]} />
          {watches.length === 0 && <p className="dk-note">No watches yet.</p>}
          {watches.map((w) => (
            <div key={w.id} className={`dk-watch ${w.status}`}>
              <div className="d">{w.description}</div>
              <div className="acts">
                <Btn ghost small onClick={() => showTriggers(w)}>{triggers[w.id] ? "Hide log" : "Log"}</Btn>
                <Btn ghost small onClick={() => toggle(w)}>{w.status === "active" ? "Pause" : "Resume"}</Btn>
                <Btn ghost small onClick={() => remove(w)}>Delete</Btn>
              </div>
              <div className="m">
                <span>{w.status === "active" ? <Tag kind="red">active</Tag> : <Tag kind="mut">paused</Tag>}</span>
                <span>channel <b>{w.channel}</b></span>
                <span>evaluated <b>{utc(w.lastEvaluatedAsOf)}</b></span>
                <span>last fired <b>{w.lastFiredAt ? utc(w.lastFiredAt) : "never"}</b></span>
                <span>holds now <b>{w.lastState ? "yes" : "no"}</b></span>
              </div>
              {triggers[w.id] && (
                <div className="dk-trig">
                  {triggers[w.id]!.length === 0 && "No triggers recorded."}
                  {triggers[w.id]!.map((t) => (
                    <div key={t.id}>
                      {utc(t.firedAt)} · {t.message} · {t.delivered ? "delivered" : "not delivered"}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Sheet>
      </div>
    </div>
  );
}
