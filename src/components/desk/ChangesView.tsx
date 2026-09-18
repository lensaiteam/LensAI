"use client";
import { useCallback, useEffect, useState } from "react";
import { agentFetch, type ChangeSet } from "@/lib/agentClient";
import { Btn, Err, Placard, Sheet, Tag, pct, utc } from "./bits";

type Since = "seen" | "24h" | "7d";
const HOUR = 3_600_000;

export function ChangesView() {
  const [since, setSince] = useState<Since>("seen");
  const [watchlist, setWatchlist] = useState(false);
  const [data, setData] = useState<ChangeSet | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marked, setMarked] = useState(false);

  const load = useCallback(
    async (mark = false) => {
      setBusy(true);
      setError(null);
      const q = new URLSearchParams();
      if (since === "24h") q.set("since", String(Date.now() - 24 * HOUR));
      if (since === "7d") q.set("since", String(Date.now() - 7 * 24 * HOUR));
      if (watchlist) q.set("watchlist", "1");
      if (mark) q.set("mark", "1");
      try {
        setData(await agentFetch<ChangeSet>(`/v1/changes?${q.toString()}`));
        if (mark) setMarked(true);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [since, watchlist],
  );

  useEffect(() => {
    setMarked(false);
    load();
  }, [load]);

  const empty = data && !data.flagsOpened.length && !data.flagsCleared.length && !data.regimeChanges.length && !data.movers.length;

  return (
    <div className="dk-wrap">
      <div className="dk-top">
        <div>
          <span className="dk-kick">A05 / What changed</span>
          <h1 className="dk-title">
            What moved <em>since you last looked.</em>
          </h1>
        </div>
        <div className="dk-row">
          <div className="dk-seg" role="group" aria-label="Since">
            {(["seen", "24h", "7d"] as Since[]).map((s) => (
              <button key={s} type="button" className={since === s ? "on" : ""} onClick={() => setSince(s)}>
                {s === "seen" ? "last seen" : s}
              </button>
            ))}
          </div>
          <label className="dk-check">
            <input type="checkbox" checked={watchlist} onChange={(e) => setWatchlist(e.target.checked)} /> watchlist only
          </label>
        </div>
      </div>

      <p className="dk-note">
        Pure arithmetic between two computed anchors: flags that opened or cleared, regimes that shifted, and the factors that moved furthest
        against their own history. No model is involved, so nothing here can be invented.
      </p>

      <div className="dk-stack" style={{ marginTop: 18 }}>
        <Sheet marks>
          <Placard
            items={[
              ["from", data?.from ? utc(data.from.as_of) : busy ? "loading" : "n/a"],
              ["to", data?.to ? utc(data.to.as_of) : busy ? "loading" : "n/a"],
              ["scope", watchlist ? "watchlist" : "all assets"],
            ]}
          />
          {!data && !busy && !error && <p className="dk-note">Nothing loaded.</p>}
          {empty && <p className="dk-note">No flags opened or cleared, no regime shifts, and no factor moved materially against its own history.</p>}
          {data && !data.from && <p className="dk-note">The desk has no anchor before that time yet, so there is nothing to compare against.</p>}

          {data && data.flagsOpened.length > 0 && <FlagTable title="Flags opened" rows={data.flagsOpened} open />}
          {data && data.flagsCleared.length > 0 && <FlagTable title="Flags cleared" rows={data.flagsCleared} />}

          {data && data.regimeChanges.length > 0 && (
            <>
              <h2 className="dk-h" style={{ marginTop: 16 }}>Regime shifts</h2>
              <table className="dk-tbl">
                <thead>
                  <tr><th>regime</th><th>asset</th><th>from</th><th>to</th></tr>
                </thead>
                <tbody>
                  {data.regimeChanges.map((r, i) => (
                    <tr key={i}>
                      <td className="mono">{r.regime_key}</td>
                      <td className="mono">{r.asset}</td>
                      <td className="mono">{r.from ?? "n/a"}</td>
                      <td className="mono">{r.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {data && data.movers.length > 0 && (
            <>
              <h2 className="dk-h" style={{ marginTop: 16 }}>Largest percentile moves, 365-day window</h2>
              <table className="dk-tbl">
                <thead>
                  <tr><th>stream</th><th>asset</th><th className="n">from</th><th className="n">to</th><th className="n">move</th></tr>
                </thead>
                <tbody>
                  {data.movers.map((m, i) => (
                    <tr key={i}>
                      <td className="mono">{m.stream}/{m.source}</td>
                      <td className="mono">{m.asset}</td>
                      <td className="n">{pct(m.from)}</td>
                      <td className="n">{pct(m.to)}</td>
                      <td className="n">
                        {m.delta > 0 ? "+" : ""}{Math.round(m.delta * 100)}
                        <span className="dk-bar" aria-hidden="true">
                          <i style={{ left: `${Math.min(m.from, m.to) * 100}%`, width: `${Math.abs(m.delta) * 100}%` }} />
                          <b style={{ left: `${m.to * 100}%` }} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div className="dk-row between" style={{ marginTop: 16 }}>
            <span className="dk-note">Measured state only. Not financial advice.</span>
            <div className="dk-row">
              <Btn ghost small onClick={() => load()} disabled={busy}>Refresh</Btn>
              <Btn small onClick={() => load(true)} disabled={busy || marked || !data?.to}>{marked ? "Marked as seen" : "Mark as seen"}</Btn>
            </div>
          </div>
          <Err>{error}</Err>
        </Sheet>
      </div>
    </div>
  );
}

function FlagTable({ title, rows, open }: { title: string; rows: ChangeSet["flagsOpened"]; open?: boolean }) {
  return (
    <>
      <h2 className="dk-h" style={{ marginTop: 16 }}>{title}</h2>
      <table className="dk-tbl">
        <thead>
          <tr><th>kind</th><th>subject</th><th>window</th><th>direction</th></tr>
        </thead>
        <tbody>
          {rows.map((f, i) => (
            <tr key={i}>
              <td><Tag kind={open ? "red" : "mut"}>{f.kind.replace(/_/g, " ")}</Tag></td>
              <td className="mono">{f.subject}</td>
              <td className="mono">{f.window_id || "n/a"}</td>
              <td className="mono">{f.direction ?? "n/a"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
