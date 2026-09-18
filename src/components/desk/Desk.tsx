"use client";
import { useCallback, useEffect, useState } from "react";
import { agentFetch, isPreview, type Conversation, type Usage } from "@/lib/agentClient";
import { AskView } from "./AskView";
import { ChangesView } from "./ChangesView";
import { WatchesView } from "./WatchesView";
import { ClaimsView } from "./ClaimsView";
import { AccountView } from "./AccountView";
import { utcDay } from "./bits";

export type DeskView = "ask" | "changes" | "watches" | "claims" | "account";

/** The register, in the same index as the public agents page. */
const REGISTER: { id: DeskView; code: string; name: string; sub: string; calls: string }[] = [
  { id: "ask", code: "A01", name: "Ask", sub: "Market state, a token in it, a mechanism, an incident, the record", calls: "0 to 1" },
  { id: "changes", code: "A05", name: "What changed", sub: "Arithmetic between two anchors", calls: "0" },
  { id: "watches", code: "A06", name: "Watches", sub: "Standing conditions, alerted on the edge", calls: "1 once" },
  { id: "claims", code: "A07", name: "Claim check", sub: "Paste a post, get verdicts", calls: "1" },
  { id: "account", code: "A09", name: "Account and keys", sub: "Channels, tool endpoint, export, erase", calls: "0" },
];

export function Desk({ onSignOut }: { onSignOut: () => void }) {
  // ?view=changes deep-links a surface (and lets the preview render each one).
  const [view, setView] = useState<DeskView>(() => {
    if (typeof window === "undefined") return "ask";
    const v = new URLSearchParams(window.location.search).get("view");
    return REGISTER.some((r) => r.id === v) ? (v as DeskView) : "ask";
  });
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [conv, setConv] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("conv")));
  const [usage, setUsage] = useState<Usage | null>(null);

  const refreshUsage = useCallback(() => {
    agentFetch<Usage>("/v1/usage").then(setUsage).catch(() => {});
  }, []);
  const refreshConvs = useCallback(() => {
    agentFetch<{ conversations: Conversation[] }>("/v1/conversations").then((r) => setConvs(r.conversations)).catch(() => {});
  }, []);
  useEffect(() => {
    refreshUsage();
    refreshConvs();
  }, [refreshUsage, refreshConvs]);

  const spent = useCallback(() => {
    refreshUsage();
    refreshConvs();
  }, [refreshUsage, refreshConvs]);

  const deleteConv = async (id: string) => {
    try {
      await agentFetch(`/v1/conversations/${id}`, { method: "DELETE" });
      setConvs((c) => c.filter((x) => x.id !== id));
      if (conv === id) setConv(null);
    } catch {
      /* the rail refreshes on the next action */
    }
  };

  return (
    <div className="dk">
      <aside className="dk-rail" aria-label="Desk register">
        <div className="dk-rail-h"><span>Register</span>{isPreview() && <span style={{ color: "#ff0000" }}>specimen</span>}</div>
        <ul className="dk-reg">
          {REGISTER.map((r) => (
            <li key={r.id}>
              <button type="button" className={view === r.id ? "on" : ""} onClick={() => setView(r.id)} aria-current={view === r.id ? "page" : undefined}>
                <span className="c">{r.code}</span>
                <span className="n">{r.name}</span>
                <span className="k">{r.calls}</span>
                <span className="s">{r.sub}</span>
              </button>
            </li>
          ))}
        </ul>

        {view === "ask" && (
          <>
            <div className="dk-rail-h">
              <span>Recent</span>
              <button type="button" className="dk-link" onClick={() => setConv(null)} style={{ fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit", textTransform: "inherit" }}>
                new
              </button>
            </div>
            <ul className="dk-convs">
              {convs.length === 0 && <li className="dk-conv" style={{ color: "var(--mut)" }}>No questions yet.</li>}
              {convs.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className={`dk-conv${conv === c.id ? " on" : ""}`}
                    onClick={() => setConv(c.id)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      deleteConv(c.id);
                    }}
                    title="Right-click to delete"
                  >
                    <span>{c.title}</span>
                    <time dateTime={new Date(c.updatedAt).toISOString()}>{utcDay(c.updatedAt).slice(5)}</time>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="dk-rail-foot">
          <span>model calls today</span>
          <span>
            <b>{usage ? usage.used : "n/a"}</b> / {usage ? usage.limit : "n/a"}
          </span>
        </div>
      </aside>

      <main className="dk-main">
        {view === "ask" && <AskView conversationId={conv} onConversation={(id) => { setConv(id); refreshConvs(); }} onSpent={spent} />}
        {view === "changes" && <ChangesView />}
        {view === "watches" && <WatchesView onSpent={spent} goAccount={() => setView("account")} />}
        {view === "claims" && <ClaimsView onSpent={spent} />}
        {view === "account" && <AccountView onSignOut={onSignOut} />}
      </main>
    </div>
  );
}
