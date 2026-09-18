"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/Markdown";
import { agentAsk, agentFetch, AgentError, isPreview, type AnswerMeta, type ClaimAudit, type Message, type Stage } from "@/lib/agentClient";
import { Btn, Empty, Err, Placard, Sheet, Stagebar, Tag, utc } from "./bits";

const OPENERS: { label: string; q: string }[] = [
  { label: "Market state", q: "What is the state of the market right now?" },
  { label: "Brief on BTC", q: "Brief me on BTC." },
  { label: "What changed", q: "What changed since I last looked?" },
  { label: "Funding vs OI", q: "Is BTC funding confirmed by open interest?" },
  { label: "BTC vs ETH", q: "Compare BTC and ETH funding and basis." },
  { label: "Track record", q: "How has the desk's track record been?" },
];

type Turn = { id: string; role: "user" | "assistant"; content: string; meta: AnswerMeta | null };

export function AskView({ conversationId, initialQuestion = "", onConversation, onSpent }: { conversationId: string | null; initialQuestion?: string; onConversation: (id: string) => void; onSpent: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState(initialQuestion.slice(0, 1000));
  const [stage, setStage] = useState<Stage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Load a conversation when the rail selects one; a null id is a fresh sheet.
  useEffect(() => {
    let alive = true;
    setError(null);
    if (!conversationId) {
      setTurns([]);
      return;
    }
    agentFetch<{ messages: Message[] }>(`/v1/conversations/${conversationId}`)
      .then((r) => {
        if (!alive) return;
        setTurns(r.messages.map((m) => ({ id: m.id, role: m.role, content: m.content, meta: (m.meta as AnswerMeta | null) ?? null })));
      })
      .catch((e: AgentError) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [conversationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [turns, stage]);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = Math.min(ta.scrollHeight, 168) + "px";
  }, [input]);

  const send = useCallback(
    async (raw?: string) => {
      const q = (raw ?? input).trim();
      if (!q || busy) return;
      setInput("");
      setError(null);
      setBusy(true);
      setStage("planning");
      setTurns((t) => [...t, { id: `u-${Date.now()}`, role: "user", content: q, meta: null }]);
      try {
        const a = await agentAsk({ question: q, conversationId: conversationId ?? undefined }, setStage);
        setTurns((t) => [
          ...t,
          {
            id: a.messageId ?? `a-${Date.now()}`,
            role: "assistant",
            content: a.text,
            meta: { intent: a.intent, assets: a.assets, asOf: a.asOf, provider: a.provider, shared: a.shared, degraded: a.degraded, audit: a.audit, budgetExhausted: a.budgetExhausted },
          },
        ]);
        if (!conversationId) onConversation(a.conversationId);
        onSpent();
      } catch (e) {
        setError((e as Error).message);
        setTurns((t) => t.slice(0, -1));
        setInput(q);
      } finally {
        setBusy(false);
        setStage(null);
      }
    },
    [input, busy, conversationId, onConversation, onSpent],
  );

  const fresh = turns.length === 0 && !busy;

  return (
    <>
      <div className="dk-wrap ask">
        <div className="dk-top">
          <div>
            <span className="dk-kick">A01 · A04 · A08 / Ask</span>
            <h1 className="dk-title">
              Ask the desk <em>a question.</em>
            </h1>
          </div>
        </div>

        {fresh ? (
          <Empty title="Market state, one token in it," dim="or the mechanism between.">
            <p>
              A generic read comes from the shared brief filed each hour, so it costs nothing. A specific question spends one model call, and every
              number in the answer is checked against the store before you see it. It never says what to do.
            </p>
            <div className="dk-chips">
              {OPENERS.map((o) => (
                <button key={o.label} type="button" className="dk-chip" onClick={() => send(o.q)}>
                  {o.label}
                </button>
              ))}
            </div>
          </Empty>
        ) : (
          <div className="dk-thread">
            {turns.map((t) => (t.role === "user" ? <div key={t.id} className="dk-msg-u">{t.content}</div> : <Answer key={t.id} turn={t} />))}
            {busy && <Stagebar at={stage} />}
            <Err>{error}</Err>
            <div ref={endRef} />
          </div>
        )}
        {fresh && <Err>{error}</Err>}
      </div>

      <div className="dk-composer">
        <div className="dk-composer-in">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={conversationId ? "Follow up" : "Ask about the market, a token, or a mechanism"}
            disabled={busy}
            aria-label="Your question"
            maxLength={1000}
          />
          <div className="dk-composer-foot">
            <div className="dk-hint">
              <span><kbd>↵</kbd>send</span>
              <span><kbd>⇧↵</kbd>new line</span>
              <span>Information, not advice.</span>
            </div>
            <Btn small onClick={() => send()} disabled={busy || !input.trim()}>
              Ask
            </Btn>
          </div>
        </div>
      </div>
    </>
  );
}

function Answer({ turn }: { turn: Turn }) {
  const m = turn.meta ?? {};
  const audit = m.audit ?? [];
  const kept = audit.filter((a) => a.kept).length;
  const dropped = audit.length - kept;
  const [open, setOpen] = useState(() => isPreview());
  const [rated, setRated] = useState<1 | -1 | null>(null);
  const source = m.shared ? "shared brief" : m.degraded ? "measured state" : m.provider ? m.provider.replace(/^pool:/, "model: ") : "desk";
  // The engine appends its stamp and disclaimer as `_italic_` lines; the placard
  // already carries the anchor, so those lines become a mono footnote instead.
  const lines = turn.content.split("\n");
  const notes = lines.filter((l) => /^_.+_$/.test(l.trim())).map((l) => l.trim().slice(1, -1));
  const body = lines.filter((l) => !/^_.+_$/.test(l.trim())).join("\n").trim();

  const rate = async (rating: 1 | -1) => {
    if (rated || turn.id.startsWith("a-")) return;
    setRated(rating);
    try {
      await agentFetch("/v1/feedback", { method: "POST", body: { messageId: turn.id, rating } });
    } catch {
      /* feedback is best-effort */
    }
  };

  return (
    <Sheet marks className="dk-ans">
      <Placard
        items={[
          ["as of", utc(m.asOf)],
          m.intent ? ["read", m.intent.replace("_", " ")] : null,
          m.assets?.length ? ["assets", m.assets.join(", ")] : null,
          ["source", source],
          m.budgetExhausted ? ["budget", "spent for today"] : null,
        ]}
      />
      <Markdown className="dk-md">{body}</Markdown>
      {notes.length > 0 && <p className="dk-foot">{notes.join(" ")}</p>}
      {audit.length > 0 && (
        <div className="dk-audit">
          <button type="button" className="dk-audit-t" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            <span>{open ? "Hide the work" : "Show the work"}</span>
            <span>
              {kept} kept · {dropped} dropped
            </span>
          </button>
          {open && (
            <div className="dk-audit-rows">
              {audit.map((a, i) => (
                <AuditRow key={i} a={a} />
              ))}
            </div>
          )}
        </div>
      )}
      {!turn.id.startsWith("a-") && (
        <div className="dk-fb">
          <span>Useful?</span>
          <button type="button" className={rated === 1 ? "on" : ""} onClick={() => rate(1)} disabled={rated !== null}>Yes</button>
          <button type="button" className={rated === -1 ? "on" : ""} onClick={() => rate(-1)} disabled={rated !== null}>No</button>
        </div>
      )}
    </Sheet>
  );
}

function AuditRow({ a }: { a: ClaimAudit }) {
  return (
    <div className={`dk-audit-row${a.kept ? "" : " drop"}`}>
      <Tag kind={a.basis}>{a.basis}</Tag>
      <div>
        <span className="t">{a.text}</span>
        {!a.kept && <span className="why">dropped: {a.reason ?? "failed verification"}</span>}
        {a.refs.length > 0 && <span className="dk-refs">{a.refs.join(" · ")}</span>}
      </div>
    </div>
  );
}
