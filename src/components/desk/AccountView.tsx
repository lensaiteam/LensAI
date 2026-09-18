"use client";
import { useCallback, useEffect, useState } from "react";
import { agentFetch, type ApiKeyRecord, type Prefs, type Usage } from "@/lib/agentClient";
import { Btn, Err, Placard, Sheet, Tag, utc } from "./bits";

export function AccountView({ onSignOut }: { onSignOut: () => void }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [watchlist, setWatchlist] = useState("");
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [shownKey, setShownKey] = useState<string | null>(null);
  const [tg, setTg] = useState<{ code: string; url: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [armed, setArmed] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, u, k] = await Promise.all([agentFetch<{ prefs: Prefs }>("/v1/prefs"), agentFetch<Usage>("/v1/usage"), agentFetch<{ keys: ApiKeyRecord[] }>("/v1/api-keys")]);
      setPrefs(p.prefs);
      setWatchlist(p.prefs.watchlist.join(", "));
      setEmail(p.prefs.email ?? "");
      setUsage(u);
      setKeys(k.keys);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const act = async (name: string, fn: () => Promise<void>, done?: string) => {
    setBusy(name);
    setError(null);
    setOk(null);
    try {
      await fn();
      if (done) setOk(done);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const saveWatchlist = () =>
    act("watchlist", async () => {
      const list = watchlist.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
      const r = await agentFetch<{ prefs: Prefs }>("/v1/prefs", { method: "PUT", body: { watchlist: list } });
      setPrefs(r.prefs);
      setWatchlist(r.prefs.watchlist.join(", "));
    }, "Watchlist saved.");

  const saveEmail = () =>
    act("email", async () => {
      const r = await agentFetch<{ prefs: Prefs }>("/v1/prefs", { method: "PUT", body: { email: email.trim() || null } });
      setPrefs(r.prefs);
    }, email.trim() ? "Email saved." : "Email removed.");

  const linkTelegram = () => act("tg", async () => setTg(await agentFetch<{ code: string; url: string | null }>("/v1/telegram/link", { method: "POST" })));
  const unlinkTelegram = () =>
    act("tg", async () => {
      await agentFetch("/v1/telegram/link", { method: "DELETE" });
      setTg(null);
      await load();
    }, "Telegram unlinked.");

  const createKey = () =>
    act("key", async () => {
      const r = await agentFetch<{ key: string; record: ApiKeyRecord }>("/v1/api-keys", { method: "POST", body: { label: label.trim() } });
      setShownKey(r.key);
      setKeys((k) => [r.record, ...k]);
      setLabel("");
    });
  const revoke = (k: ApiKeyRecord) =>
    act("key", async () => {
      await agentFetch(`/v1/api-keys/${k.id}`, { method: "DELETE" });
      setKeys((ks) => ks.map((x) => (x.id === k.id ? { ...x, revoked: true } : x)));
    });

  const exportAll = () =>
    act("export", async () => {
      const data = await agentFetch<Record<string, unknown>>("/v1/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `lensai-desk-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });

  const erase = () =>
    act("erase", async () => {
      await agentFetch("/v1/account", { method: "DELETE" });
      onSignOut();
    });

  return (
    <div className="dk-wrap">
      <div className="dk-top">
        <div>
          <span className="dk-kick">A09 / Account and keys</span>
          <h1 className="dk-title">
            What the desk <em>holds about you.</em>
          </h1>
        </div>
      </div>

      <div className="dk-stack">
        <Sheet marks>
          <Placard items={[["today", usage ? `${usage.used} of ${usage.limit} model calls` : "loading"], ["resets", "00:00 UTC"], ["watchlist", String(prefs?.watchlist.length ?? 0)]]} />
          <dl className="dk-kv">
            <dt>Watchlist</dt>
            <dd>
              <input className="dk-in mono" value={watchlist} onChange={(e) => setWatchlist(e.target.value)} placeholder="BTC, ETH, SOL" aria-label="Watchlist symbols" />
              <div className="dk-row" style={{ marginTop: 8 }}>
                <span className="dk-note">Symbols only. Used to scope what changed. No amounts, no balances.</span>
                <Btn ghost small onClick={saveWatchlist} disabled={busy === "watchlist"}>Save</Btn>
              </div>
            </dd>
            <dt>Email alerts</dt>
            <dd>
              <input className="dk-in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Only if you want email alerts" aria-label="Alert email" />
              <div className="dk-row" style={{ marginTop: 8 }}>
                <span className="dk-note">Held only while set. Never placed in a prompt.</span>
                <Btn ghost small onClick={saveEmail} disabled={busy === "email"}>{email.trim() ? "Save" : prefs?.email ? "Remove" : "Save"}</Btn>
              </div>
            </dd>
            <dt>Telegram alerts</dt>
            <dd>
              {prefs?.telegramChatId ? (
                <div className="dk-row">
                  <Tag kind="ink">linked</Tag>
                  <Btn ghost small onClick={unlinkTelegram} disabled={busy === "tg"}>Unlink</Btn>
                </div>
              ) : tg ? (
                <div>
                  <p className="dk-note">
                    Open the bot and send the start command. The link completes when the bot sees your code.
                  </p>
                  {tg.url ? (
                    <p className="dk-note"><a className="dk-link" href={tg.url} target="_blank" rel="noreferrer">Open the LensAI bot</a></p>
                  ) : (
                    <p className="dk-note">The Telegram bot is not configured on this deployment yet.</p>
                  )}
                  <div className="dk-code">/start {tg.code}</div>
                  <div className="dk-row" style={{ marginTop: 8 }}>
                    <Btn ghost small onClick={load}>I have sent it</Btn>
                  </div>
                </div>
              ) : (
                <div className="dk-row">
                  <span className="dk-note">Not linked.</span>
                  <Btn ghost small onClick={linkTelegram} disabled={busy === "tg"}>Link Telegram</Btn>
                </div>
              )}
            </dd>
          </dl>
          {ok && <p className="dk-ok">{ok}</p>}
          <Err>{error}</Err>
        </Sheet>

        <Sheet>
          <Placard items={[["A09", "tool endpoint"], ["keys", `${keys.filter((k) => !k.revoked).length} active of 5`]]} />
          <p className="dk-note">
            An API key reaches the read and ask surface only: ask, what changed, claim check, usage, and the JSON-RPC tool endpoint. It can
            never manage this account. Only a hash is stored, so the key is shown once.
          </p>
          <div className="dk-row" style={{ marginTop: 12 }}>
            <input className="dk-in" style={{ maxWidth: 280 }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label, e.g. notebook" maxLength={60} aria-label="Key label" />
            <Btn onClick={createKey} disabled={busy === "key" || !label.trim() || keys.filter((k) => !k.revoked).length >= 5}>Create key</Btn>
          </div>
          {shownKey && (
            <>
              <div className="dk-code">{shownKey}</div>
              <p className="dk-note" style={{ marginTop: 6 }}>Copy it now. It will not be shown again.</p>
            </>
          )}
          {keys.length > 0 && (
            <table className="dk-tbl" style={{ marginTop: 14 }}>
              <thead>
                <tr><th>label</th><th>prefix</th><th>created</th><th>last used</th><th></th></tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td>{k.label}</td>
                    <td className="mono">{k.prefix}…</td>
                    <td className="mono">{utc(k.createdAt)}</td>
                    <td className="mono">{k.lastUsedAt ? utc(k.lastUsedAt) : "never"}</td>
                    <td className="n">{k.revoked ? <Tag kind="mut">revoked</Tag> : <Btn ghost small onClick={() => revoke(k)} disabled={busy === "key"}>Revoke</Btn>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Sheet>

        <Sheet>
          <Placard items={[["your data", "export or erase"]]} />
          <p className="dk-note">
            Everything the desk holds for this wallet is a plain JSON export away: conversations, watches and their log, kept claim checks,
            preferences and key records. Erasing removes all of it at once. Nothing you do here touches the append-only corpus, which never
            held your data in the first place.
          </p>
          <div className="dk-row" style={{ marginTop: 12 }}>
            <Btn ghost onClick={exportAll} disabled={busy === "export"}>Export JSON</Btn>
            {!armed ? (
              <Btn ghost onClick={() => setArmed(true)}>Erase desk data</Btn>
            ) : (
              <>
                <span className="dk-note">This cannot be undone.</span>
                <Btn onClick={erase} disabled={busy === "erase"}>Yes, erase everything</Btn>
                <Btn ghost onClick={() => setArmed(false)}>Keep it</Btn>
              </>
            )}
          </div>
        </Sheet>
      </div>
    </div>
  );
}
