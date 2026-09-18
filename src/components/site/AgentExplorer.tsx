"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { AGENTS, FACTORS, KINDS, STEPS, deskHref, type AgentSpec, type KindId } from "@/lib/site/agents";

const EASE = [0.16, 1, 0.3, 1] as const;
type Filter = KindId | "all";

/**
 * The agent explorer: a typed index on the left, the selected agent's placard on
 * the right — a register, not a card grid. ↑/↓ (or j/k) walk the index. The URL
 * tracks the selection (/agents/<slug>) without a navigation, so any agent is
 * linkable and the back button behaves.
 */
export function AgentExplorer({ initialSlug }: { initialSlug?: string }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [slug, setSlug] = useState(initialSlug ?? AGENTS[0].slug);
  const rowRefs = useRef(new Map<string, HTMLButtonElement>());

  const visible = useMemo(() => (filter === "all" ? AGENTS : AGENTS.filter((a) => a.kind === filter)), [filter]);
  const agent = AGENTS.find((a) => a.slug === slug) ?? AGENTS[0];

  const select = useCallback((next: string, focus = false) => {
    setSlug(next);
    window.history.replaceState(null, "", `/agents/${next}`);
    if (focus) rowRefs.current.get(next)?.focus({ preventScroll: true });
  }, []);

  // A filter that hides the selected agent moves the selection to the first visible one.
  useEffect(() => {
    if (!visible.some((a) => a.slug === slug)) select(visible[0].slug);
  }, [visible, slug, select]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const dir = e.key === "ArrowDown" || e.key === "j" ? 1 : e.key === "ArrowUp" || e.key === "k" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const i = visible.findIndex((a) => a.slug === slug);
    select(visible[(i + dir + visible.length) % visible.length].slug, true);
  };

  return (
    <div className="ax">
      <div className="ax-filters" role="tablist" aria-label="Agent type">
        {([{ id: "all", label: "All" }, ...KINDS] as { id: Filter; label: string }[]).map((k) => {
          const n = k.id === "all" ? AGENTS.length : AGENTS.filter((a) => a.kind === k.id).length;
          return (
            <button key={k.id} role="tab" aria-selected={filter === k.id} className={`ax-filter${filter === k.id ? " on" : ""}`} onClick={() => setFilter(k.id)}>
              {k.label}
              <span className="ax-count">{String(n).padStart(2, "0")}</span>
            </button>
          );
        })}
        <span className="ax-hint mono">↑ ↓ to walk the index</span>
      </div>

      <div className="ax-grid">
        <div className="ax-index" role="listbox" aria-label="Agents" onKeyDown={onKeyDown}>
          <div className="ax-head mono" aria-hidden="true">
            <span>Index</span><span>Agent</span><span>Type</span><span className="r">Model calls</span>
          </div>
          {visible.map((a) => {
            const on = a.slug === slug;
            return (
              <button
                key={a.slug}
                ref={(el) => { if (el) rowRefs.current.set(a.slug, el); else rowRefs.current.delete(a.slug); }}
                role="option"
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                className={`ax-row${on ? " on" : ""}`}
                onClick={() => select(a.slug)}
              >
                <span className="ax-code mono">
                  {on && <motion.i layoutId="ax-mark" className="ax-mark" transition={{ duration: 0.45, ease: EASE }} />}
                  {a.code}
                </span>
                <span className="ax-name">
                  <b>{a.name}</b>
                  <em>{a.line}</em>
                </span>
                <span className="ax-kind mono">{a.kind}</span>
                <span className="ax-calls mono">{a.calls.value}</span>
              </button>
            );
          })}
        </div>

        <aside className="ax-detail" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={agent.slug} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.32, ease: EASE }}>
              <Placard agent={agent} />
            </motion.div>
          </AnimatePresence>
        </aside>
      </div>
    </div>
  );
}

function Placard({ agent }: { agent: AgentSpec }) {
  const kind = KINDS.find((k) => k.id === agent.kind)!;
  // The step that best explains this agent: arithmetic if it has any, else the verification gate.
  const keyStep = agent.path.includes("compute") ? "compute" : agent.path.includes("verify") ? "verify" : agent.path[agent.path.length - 1];
  return (
    <article className="pl">
      <header className="pl-top mono">
        <span>{agent.code}</span>
        <span>{kind.label}</span>
        <span className="pl-ep">{agent.endpoint}</span>
      </header>

      <h2 className="display pl-title">{agent.name}</h2>
      <p className="pl-about">{agent.about}</p>

      <section className="pl-sec">
        <h3 className="pl-h mono">Reads</h3>
        <ul className="pl-factors">
          {FACTORS.map((f) => {
            const on = agent.reads.includes(f.id);
            return (
              <li key={f.id} className={on ? "on" : ""} aria-label={`${f.label}: ${on ? "read" : "not read"}`}>
                <i aria-hidden="true" />
                {f.label}
              </li>
            );
          })}
        </ul>
        {agent.reads.length === 0 && <p className="pl-note">Reads the desk&apos;s own calibration record, not the market.</p>}
      </section>

      <section className="pl-sec">
        <h3 className="pl-h mono">How it answers</h3>
        <ol className="pl-path">
          {STEPS.map((s) => {
            const on = agent.path.includes(s.id);
            return (
              <li key={s.id} className={on ? "on" : ""} title={s.note}>
                <span className="mono">{s.label}</span>
              </li>
            );
          })}
        </ol>
        <p className="pl-note">{STEPS.find((s) => s.id === keyStep)!.note}</p>
      </section>

      <dl className="pl-kv">
        <div>
          <dt className="mono">Model calls</dt>
          <dd><b>{agent.calls.value}</b><span>{agent.calls.note}</span></dd>
        </div>
        <div>
          <dt className="mono">You get</dt>
          <dd><span>{agent.output}</span></dd>
        </div>
        <div>
          <dt className="mono">It won&apos;t</dt>
          <dd><span>{agent.wont}</span></dd>
        </div>
      </dl>

      <section className="pl-sec">
        <h3 className="pl-h mono">{agent.kind === "connect" ? "Call it" : "Say to it"}</h3>
        <ul className="pl-asks">
          {agent.asks.map((q) =>
            agent.kind === "connect" ? (
              <li key={q} className="mono">{q}</li>
            ) : (
              <li key={q}>
                <Link href={deskHref(agent, q)} title="Open in the desk with this question">{`“${q}”`}</Link>
              </li>
            ),
          )}
        </ul>
      </section>

      <footer className="pl-foot">
        <span className="pl-status mono"><i aria-hidden="true" />Live in the desk</span>
        <span className="pl-links">
          <Link className="tlink" href={deskHref(agent)}><span>Open in the desk</span><span className="a">→</span></Link>
          <Link className="tlink" href="/whitepaper#agents"><span>How it works</span><span className="a">→</span></Link>
        </span>
      </footer>
    </article>
  );
}
