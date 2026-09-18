"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { CountUp, EASE, LineReveal, Marks } from "./kit";

/**
 * SPECIMEN data. The hero demonstrates what the desk files; it is not a live feed,
 * and it says so on the sheet. The tape and the brief agree with each other (the
 * brief's numbers are the tape's numbers), exactly as the engine requires.
 */
const TAPE = [
  { id: "funding", label: "Funding", pct: 94, regime: "elevated", flag: false },
  { id: "basis", label: "Basis / yield", pct: 42, regime: "neutral", flag: false },
  { id: "macro", label: "Macro", pct: 70, regime: "firm dollar", flag: false },
  { id: "flows", label: "Flows", pct: 38, regime: "neutral", flag: false },
  { id: "depth", label: "Depth", pct: 7, regime: "thin", flag: true },
  { id: "news", label: "News", pct: 52, regime: "neutral", flag: false },
] as const;

type Basis = "measured" | "mechanical" | "conjecture";
const CLAIMS: { basis: Basis; text: string; ref: string; dropped?: string }[] = [
  { basis: "measured", text: "BTC perp funding sits at the 94th percentile of its own 365-day history.", ref: "pctl:funding_rate/binance/BTC/365d" },
  { basis: "measured", text: "Resting depth is thin: 7th percentile, flagged as a historical extreme.", ref: "div:extreme_state/market_depth" },
  { basis: "mechanical", text: "Elevated funding widens the carry spread and draws basis-trade capital.", ref: "edge:funding_to_basis" },
  { basis: "measured", text: "Basis has followed it up, to the 88th percentile.", ref: "pctl:basis/binance/BTC/365d", dropped: "Dropped: the store reads P42. The number did not resolve." },
  { basis: "conjecture", text: "Basis has not followed funding; with depth this thin, an unwind would travel further than usual.", ref: "labeled conjecture" },
];
const DROP_AT = CLAIMS.length; // the strike lands after every claim has been set
const DONE_AT = CLAIMS.length + 1;

function Brief() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const [hour, setHour] = useState("--");

  useEffect(() => setHour(String(new Date().getUTCHours()).padStart(2, "0")), []);
  useEffect(() => {
    if (reduce) { setStep(DONE_AT); return; }
    setStep(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= DONE_AT; i++) timers.push(setTimeout(() => setStep(i), 700 + i * 950));
    return () => timers.forEach(clearTimeout);
  }, [run, reduce]);

  const kept = CLAIMS.filter((c) => !c.dropped).length;

  return (
    <motion.aside className="brief-sheet" aria-label="A specimen brief" initial={{ opacity: 0, y: 26 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, ease: EASE, delay: 0.35 }}>
      <Marks />
      <header className="bs-top mono">
        <span><i className="bs-dot" aria-hidden="true" />Brief · Market State</span>
        <span className="bs-spec">Specimen</span>
      </header>
      <div className="bs-meta mono">
        <span>as of {hour}:00 UTC</span>
        <span>point-in-time · no lookahead</span>
      </div>

      <ol className="bs-claims">
        {CLAIMS.map((c, i) => {
          const shown = step > i;
          const struck = !!c.dropped && step >= DROP_AT;
          return (
            <motion.li key={i} className={`bs-claim${struck ? " struck" : ""}`} initial={false} animate={{ opacity: shown ? 1 : 0, y: shown ? 0 : 10 }} transition={{ duration: 0.6, ease: EASE }}>
              <span className={`bs-tag mono ${c.basis}`}>{c.basis}</span>
              <p>
                <span className="bs-text">
                  {c.text}
                  {c.dropped && <motion.i className="bs-strike" aria-hidden="true" initial={false} animate={{ scaleX: struck ? 1 : 0 }} transition={{ duration: 0.7, ease: EASE }} />}
                </span>
                <span className="bs-ref mono">{c.ref}</span>
                {c.dropped && (
                  <motion.span className="bs-drop mono" initial={false} animate={{ opacity: struck ? 1 : 0, x: struck ? 0 : -8 }} transition={{ duration: 0.5, ease: EASE, delay: struck ? 0.35 : 0 }}>
                    {c.dropped}
                  </motion.span>
                )}
              </p>
            </motion.li>
          );
        })}
      </ol>

      <motion.footer className="bs-foot mono" initial={false} animate={{ opacity: step >= DONE_AT ? 1 : 0 }} transition={{ duration: 0.6, ease: EASE }}>
        <span><b>{kept}</b> of {CLAIMS.length} claims survived verification</span>
        <button type="button" className="bs-replay mono" onClick={() => setRun((r) => r + 1)}>Replay the filing ↺</button>
      </motion.footer>
    </motion.aside>
  );
}

function Tape() {
  return (
    <div className="tape6" role="group" aria-label="The tape: six factor families, specimen readings">
      <div className="t6-cap mono">
        <span>The tape</span>
        <em>six families · each against its own history · specimen readings</em>
      </div>
      <div className="t6-row">
        {TAPE.map((f, i) => (
          <div key={f.id} className={`t6-cell${f.flag ? " flag" : ""}`}>
            <span className="t6-label mono">{f.label}</span>
            <span className="t6-val mono">P<CountUp to={f.pct} pad={2} delay={0.5 + i * 0.07} /></span>
            <span className="t6-bar" aria-hidden="true">
              <motion.i initial={{ scaleX: 0 }} whileInView={{ scaleX: f.pct / 100 }} viewport={{ once: true }} transition={{ duration: 1.3, ease: EASE, delay: 0.5 + i * 0.07 }} />
            </span>
            <span className="t6-regime mono">{f.flag ? "flagged · " : ""}{f.regime}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <section className="hx">
      <div className="hx-in lp-wrap">
        <div className="hx-copy">
          <motion.span className="kicker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.1 }}>LensAI · The research desk</motion.span>
          <LineReveal className="display hx-title" lines={["Read the signal,", <em key="n" className="dim">not the noise.</em>]} />
          <motion.p className="hx-sub" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.45 }}>
            A crypto research desk that reads funding, basis, macro, flows, depth and news <b>together</b>, and shows its work. Ask it. Leave it watching. Hand it a claim.
          </motion.p>
          <motion.div className="hx-cta" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.58 }}>
            <Link className="mast-cta hx-primary" href="/app"><span>Open the desk</span><span className="a" aria-hidden="true">→</span></Link>
            <Link className="tlink" href="/agents"><span>Explore the agents</span><span className="a">→</span></Link>
          </motion.div>
          <motion.ul className="hx-facts mono" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, delay: 0.8 }}>
            <li><b>06</b>factor families</li>
            <li><b>01</b>clock</li>
            <li><b>09</b>agents</li>
            <li><b>00</b>advice</li>
          </motion.ul>
        </div>
        <Brief />
      </div>
      <div className="lp-wrap"><Tape /></div>
    </section>
  );
}
