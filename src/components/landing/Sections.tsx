"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useMotionValueEvent, useScroll, useSpring } from "framer-motion";
import { AGENTS } from "@/lib/site/agents";
import { PIPELINE } from "@/lib/site/graph";
import { EASE, LineReveal, Marks, Sec } from "./kit";

const rise = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "0px 0px -10% 0px" } } as const;

/* ── 02 · METHOD — the pipeline, walked by the scroll ───────────────────────── */
export function Method() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 62%", "end 58%"] });
  const line = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });
  const [at, setAt] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setAt(Math.min(PIPELINE.length - 1, Math.max(0, Math.floor(v * PIPELINE.length)))));

  return (
    <Sec n="02" label="Method" id="method">
      <LineReveal as="h2" className="display" lines={["The model never", <span key="d" className="dim">finds the dots.</span>]} />
      <motion.p className="intro" {...rise} transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}>
        Six steps, in strict order. The first four are arithmetic and storage. A model appears only at step five, and step six exists to check it.
      </motion.p>

      <div className="mt" ref={ref}>
        <span className="mt-rail" aria-hidden="true"><motion.i style={{ scaleY: line }} /></span>
        <ol>
        {PIPELINE.map((s, i) => (
          <motion.li key={s.n} className={`mt-step${i <= at ? " reached" : ""}${i === at ? " at" : ""}`} {...rise} transition={{ duration: 0.75, ease: EASE, delay: 0.04 * i }}>
            <span className="mt-n mono">{s.n}</span>
            <div className="mt-body">
              <h3>{s.h}<em className="mono">{i < 4 ? "no model" : i === 4 ? "one generation" : "fail-closed"}</em></h3>
              <p>{s.p}</p>
              <code className="mt-art mono"><b>specimen</b>{s.artifact}</code>
            </div>
          </motion.li>
        ))}
        </ol>
      </div>
    </Sec>
  );
}

/* ── 03 · AGENTS — a typed index into /agents ───────────────────────────────── */
export function AgentsIndex() {
  return (
    <Sec n="03" label="Agents" id="agents">
      <LineReveal as="h2" className="display" lines={["Ask it. Leave it watching.", <span key="d" className="dim">Hand it a claim.</span>]} />
      <motion.p className="intro" {...rise} transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}>
        Nine agents reach the same measured engine in different ways, and the ones that can be pure arithmetic are, so they cannot invent a number.
      </motion.p>
      <div className="agx">
        <div className="agx-head mono" aria-hidden="true"><span>Index</span><span>Agent</span><span>Type</span><span>Model calls</span></div>
        {AGENTS.map((a, i) => (
          <motion.div key={a.slug} {...rise} transition={{ duration: 0.7, ease: EASE, delay: 0.03 * i }}>
            <Link className="agx-row" href={`/agents/${a.slug}`}>
              <span className="agx-code mono">{a.code}</span>
              <span className="agx-name"><b>{a.name}</b><em>{a.line}</em></span>
              <span className="agx-kind mono">{a.kind}</span>
              <span className="agx-calls mono">{a.calls.value}</span>
              <span className="agx-arrow" aria-hidden="true">→</span>
            </Link>
          </motion.div>
        ))}
      </div>
      <motion.div className="agx-cta" {...rise} transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}>
        <Link className="tlink" href="/agents"><span>Explore the agents</span><span className="a">→</span></Link>
      </motion.div>
    </Sec>
  );
}

/* ── 04 · STANCE — what it will never say ───────────────────────────────────── */
const NEVER = ["Buy.", "Sell.", "You should.", "Price target.", "Allocate 10%."];
const TYPES = [
  { tag: "measured", h: "Measured", p: "A number or a state read directly from the store, and traceable back to the row it came from." },
  { tag: "mechanical", h: "Mechanical", p: "A documented transmission channel. It must cite the edge in the mechanism graph, or it does not ship." },
  { tag: "conjecture", h: "Conjecture", p: "Anything else. It is allowed, as long as it is labeled and never dressed up as a finding." },
] as const;

export function Stance() {
  return (
    <Sec n="04" label="Stance" id="stance">
      <LineReveal as="h2" className="display" lines={["It describes.", <span key="d" className="dim">You decide.</span>]} />
      <motion.p className="intro" {...rise} transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}>
        Telling you what to do with your money is advice, and the desk is built so that it cannot give any. A filter sits in front of everything it emits; these never pass it.
      </motion.p>

      <ul className="nv" aria-label="Phrases the desk never emits">
        {NEVER.map((w, i) => (
          <motion.li key={w} className="display" {...rise} transition={{ duration: 0.7, ease: EASE, delay: 0.06 * i }}>
            <span>
              {w}
              <motion.i aria-hidden="true" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true, margin: "0px 0px -18% 0px" }} transition={{ duration: 0.8, ease: EASE, delay: 0.3 + 0.08 * i }} />
            </span>
          </motion.li>
        ))}
      </ul>

      <div className="ty">
        <div className="ty-cap mono">What it says instead: every claim is one of three</div>
        {TYPES.map((t, i) => (
          <motion.div key={t.tag} className="ty-row" {...rise} transition={{ duration: 0.7, ease: EASE, delay: 0.05 * i }}>
            <span className={`bs-tag mono ${t.tag}`}>{t.tag}</span>
            <h3>{t.h}</h3>
            <p>{t.p}</p>
          </motion.div>
        ))}
      </div>
    </Sec>
  );
}

/* ── 05 · ACCESS ────────────────────────────────────────────────────────────── */
const ACCESS = [
  ["A.1", "Sign in with a signature", "Prove you own your wallet by signing a message. No transaction, no gas, no keys on our servers."],
  ["A.2", "The address is the account", "No name, no password. An email or Telegram chat is held only if you ask for watch alerts through it."],
  ["A.3", "Nothing about you reaches a model", "Your text is scrubbed of addresses, emails and handles, and the router refuses any prompt that still carries one."],
  ["A.4", "Erased on request", "One action removes the account and everything the agents hold: conversations, watches, keys. Export it first if you like."],
] as const;

export function Access() {
  return (
    <Sec n="05" label="Access" id="access">
      <LineReveal as="h2" className="display" lines={["Your keys. Your data.", <span key="d" className="dim">Your call.</span>]} />
      <div className="access-split">
        <div className="arows">
          {ACCESS.map(([n, h, p], i) => (
            <motion.div key={n} className="arow" {...rise} transition={{ duration: 0.7, ease: EASE, delay: 0.04 * i }}>
              <div className="n">{n}</div><div><h3>{h}</h3><p>{p}</p></div>
            </motion.div>
          ))}
        </div>
        <motion.div className="sign-wrap" {...rise} transition={{ duration: 0.9, ease: EASE, delay: 0.1 }}>
          <div className="sign-sheet">
            <Marks />
            <div className="sign-top mono"><span><i className="bs-dot" aria-hidden="true" />Signature request</span><span>Specimen</span></div>
            <p className="sign-line">lensai.app wants you to sign in with your Ethereum account:</p>
            <code className="sign-addr mono">0x7a3f…9c2e</code>
            <ul className="sign-meta mono">
              <li>No transaction</li><li>No gas fee</li><li>No keys ever stored</li>
            </ul>
            <Link className="mast-cta sign-go" href="/app"><span>Open the desk</span><span className="a" aria-hidden="true">→</span></Link>
          </div>
        </motion.div>
      </div>
    </Sec>
  );
}

/* ── CLOSE ──────────────────────────────────────────────────────────────────── */
export function Close() {
  return (
    <section className="lp-wrap close2">
      <LineReveal as="h2" className="display" lines={["Put the desk", <span key="d" className="dim">to work.</span>]} />
      <motion.div className="close2-cta" {...rise} transition={{ duration: 0.8, ease: EASE, delay: 0.15 }}>
        <Link className="mast-cta hx-primary" href="/app"><span>Open the desk</span><span className="a" aria-hidden="true">→</span></Link>
        <Link className="tlink" href="/whitepaper"><span>Read how it works</span><span className="a">→</span></Link>
      </motion.div>
    </section>
  );
}
