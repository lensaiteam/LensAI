"use client";
import { useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion, useScroll, useSpring, useMotionValueEvent } from "framer-motion";
import { Reveal, Stagger, Item, SmoothScroll } from "@/components/motion";
import "./landing.css";

const EASE = [0.16, 1, 0.3, 1] as const;

function Reticle() {
  return (
    <>
      <span className="rc tl" /><span className="rc tr" /><span className="rc bl" /><span className="rc br" />
    </>
  );
}

const READ = [
  { i: "R·01", h: "Snapshot", p: "Price, market cap, 24h/7d, volume and supply — the state of the asset in tabular precision." },
  { i: "R·02", h: "Tokenomics", p: "Supply model, holder concentration and unlock risk — what the token's structure actually means." },
  { i: "R·03", h: "Developments & sentiment", p: "Recent catalysts and the tone of coverage, each attributed to its source — not vibes." },
  { i: "R·04", h: "Risk flags", p: "Liquidity, volatility and security signals surfaced plainly: green, amber, red." },
  { i: "R·05", h: "Overall read", p: "An honest synthesis with the reasoning — and follow-ups answered from the same gathered data." },
];

const METHOD = [
  { k: "01 · RESOLVE", h: "Point the instrument", p: "Type any ticker or address. LensAI resolves it across Coinbase and CoinGecko — or tells you plainly if it can't." },
  { k: "02 · GATHER", h: "Pull the signal", p: "Live price, volume, supply and current news are read in real time. The pipeline is the product, not the model's memory." },
  { k: "03 · ASSESS", h: "Return the read", p: "A decision-grade briefing with an honest POSITIVE / MIXED / NEGATIVE assessment — both cases, no buy button." },
];

const STANCE = [
  { c: "pos", t: "POSITIVE", p: "Strong fundamentals, healthy liquidity, constructive flow — with the bear case still named." },
  { c: "mix", t: "MIXED", p: "Real strengths against real risks. We hold the tension rather than resolve it for you." },
  { c: "neg", t: "NEGATIVE", p: "Thin liquidity, concentration, red flags — or a token we simply can't verify, said plainly." },
];

const RECORD = [
  { k: "AUTH", h: "A signature, nothing more", p: "Prove you own your wallet by signing a message. No transaction, no gas, no keys on our servers." },
  { k: "DATA", h: "The address is the account", p: "No email, no password, no PII. Just your wallet — and two free reads to begin." },
  { k: "CONTROL", h: "Erased on request", p: "One action removes your account and every session. Crypto-native by default." },
];

const SPARK = [40, 41, 39, 43, 42, 46, 44, 43, 48, 47, 51, 49, 54, 52, 57, 56, 60, 63];
function sparkPath(fill: boolean) {
  const W = 300, H = 64, max = Math.max(...SPARK), min = Math.min(...SPARK);
  const d = SPARK.map((v, i) => {
    const x = (i / (SPARK.length - 1)) * W;
    const y = H - 6 - ((v - min) / (max - min)) * (H - 12);
    return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return fill ? `${d} L300 64 L0 64 Z` : d;
}

export default function Landing() {
  return (
    <SmoothScroll>
      <Inner />
    </SmoothScroll>
  );
}

function Inner() {
  const [stuck, setStuck] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });
  useMotionValueEvent(scrollYProgress, "change", (v) => setStuck(v > 0.02));

  return (
    <div className="lp">
      <div className="lp-frame" aria-hidden>
        <span className="plus p1" /><span className="plus p2" /><span className="plus p3" /><span className="plus p4" />
        <span className="reg tl">LENSAI · DESK</span>
        <span className="reg tr">OPTICS · v1</span>
        <span className="reg bl">NON-ADVISORY</span>
        <span className="reg br">FOCUS · LOCKED</span>
      </div>
      <motion.div
        aria-hidden
        style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 1, zIndex: 60,
          background: "var(--gold)", transformOrigin: "left", scaleX: progress,
        }}
      />

      {/* Dossier header */}
      <nav className={`lp-nav${stuck ? " stuck" : ""}`}>
        <Link className="brand" href="/">
          <span className="glyph" />
          <span className="wm">LensAI<small>Intelligence Desk</small></span>
        </Link>
        <div className="lp-nav-right">
          <a className="navlink" href="#read">The read</a>
          <a className="navlink" href="#method">Method</a>
          <a className="navlink" href="#stance">Stance</a>
          <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
          <Link href="/app" className="btn btn-primary btn-sm"><span>Open desk</span></Link>
        </div>
      </nav>

      {/* HERO */}
      <header className="lp-wrap hero">
        <div>
          <motion.div className="hero-head"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}>
            <span className="code"><b>LENSAI</b> · INTELLIGENCE DESK</span>
            <span className="line" />
            <span className="code">NON-ADVISORY</span>
          </motion.div>

          <motion.h1 className="display"
            initial={{ opacity: 0, filter: "blur(12px)", y: 10 }}
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            transition={{ duration: 1.1, ease: EASE, delay: 0.15 }}>
            Read the <em>signal</em>,<br />not the noise.
          </motion.h1>

          <motion.p className="hero-sub"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.5 }}>
            A research instrument for crypto. Point it at any token and get a decision-grade read from
            live data and current news — the assessment, the reasoning, both sides. Never a buy button.
          </motion.p>

          <motion.div className="hero-cta"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease: EASE, delay: 0.65 }}>
            <Link href="/app" style={{ textDecoration: "none" }}>
              <button className="btn btn-primary"><span>Analyze a token</span><span className="arw">→</span></button>
            </Link>
            <a href="#method" style={{ textDecoration: "none" }}>
              <button className="btn btn-ghost"><span>How it works</span></button>
            </a>
          </motion.div>

          <motion.div className="hero-foot"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.9, ease: EASE, delay: 0.85 }}>
            <div className="stat"><div className="n mono">02</div><div className="l">free reads</div></div>
            <div className="stat"><div className="n mono">06</div><div className="l">sections per read</div></div>
            <div className="stat"><div className="n mono">00</div><div className="l">buy signals</div></div>
          </motion.div>
        </div>

        {/* Instrument readout */}
        <motion.div
          initial={{ opacity: 0, filter: "blur(14px)", scale: 1.015 }}
          animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
          transition={{ duration: 1.2, ease: EASE, delay: 0.4 }}>
          <div className="readout reticle">
            <Reticle />
            <div className="rhead">
              <span className="t">Reading · Lens/01</span>
              <span className="live">LIVE</span>
            </div>
            <div className="asset">
              <div>
                <div className="nm">BTC · Bitcoin</div>
                <div className="px">$62,578.74</div>
              </div>
              <div className="chg up">+5.22%<br /><span style={{ color: "var(--mut)" }}>7D</span></div>
            </div>
            <svg className="sig" viewBox="0 0 300 64" preserveAspectRatio="none">
              <defs>
                <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor="var(--pos)" stopOpacity="0.22" />
                  <stop offset="1" stopColor="var(--pos)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path className="fill" d={sparkPath(true)} fill="url(#sg)" />
              <path className="line" d={sparkPath(false)} fill="none" stroke="var(--pos)" strokeWidth="1.4" pathLength={1} vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="row"><span>MARKET CAP</span><span>$1.25T</span></div>
            <div className="row"><span>24H VOLUME</span><span>$28.4B</span></div>
            <div className="row"><span>SUPPLY</span><span>19.7M / 21M</span></div>
            <div className="row"><span>RANK</span><span>#01</span></div>
            <div className="conf">
              <div className="cl"><span>SIGNAL CONFIDENCE</span><b>78% · HIGH</b></div>
              <div className="bar"><i /></div>
            </div>
            <div className="verdict-row">
              <span className="stamp pos"><b>ASSESSMENT — POSITIVE</b></span>
              <span className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>as of 22:19</span>
            </div>
            <div className="disc mono">Information, not advice. Do your own research.</div>
          </div>
        </motion.div>

        <div className="scrollcue">↓ Scroll · brief begins</div>
      </header>

      {/* §01 THE READ */}
      <section className="lp-wrap lp-section" id="read">
        <div className="sec-head">
          <Reveal variant="rise"><div className="sec-ref"><span className="n">§01</span>The read</div></Reveal>
          <Reveal variant="focus" delay={0.05}>
            <h2 className="display h2">Every read is a briefing — <em style={{ fontStyle: "normal", color: "var(--gold)" }}>not a number.</em></h2>
            <p className="lead" style={{ marginTop: 14 }}>One pass produces six attributed sections. The expensive part — gathering live data and news — happens once and is cached, so popular tokens return instantly.</p>
          </Reveal>
        </div>
        <Stagger className="read-list" gap={0.06}>
          {READ.map((r) => (
            <Item key={r.i} className="read-row" variant="rise">
              <div className="idx">{r.i}</div>
              <div><h3>{r.h}</h3><p>{r.p}</p></div>
            </Item>
          ))}
        </Stagger>
      </section>

      {/* §02 THE METHOD */}
      <section className="lp-wrap lp-section" id="method">
        <div className="sec-head">
          <Reveal variant="rise"><div className="sec-ref"><span className="n">§02</span>The method</div></Reveal>
          <Reveal variant="focus" delay={0.05}>
            <h2 className="display h2">Point the instrument. <em style={{ fontStyle: "normal", color: "var(--gold)" }}>Get a read.</em></h2>
          </Reveal>
        </div>
        <Stagger className="method" gap={0.09}>
          {METHOD.map((m) => (
            <Item key={m.k} className="step" variant="focus">
              <div className="k">{m.k}</div>
              <h3>{m.h}</h3>
              <p>{m.p}</p>
            </Item>
          ))}
        </Stagger>
      </section>

      {/* §03 THE STANCE */}
      <section className="lp-wrap lp-section" id="stance">
        <div className="sec-head">
          <Reveal variant="rise"><div className="sec-ref"><span className="n">§03</span>The stance</div></Reveal>
          <Reveal variant="focus" delay={0.05}>
            <h2 className="display h2">We assess. <em style={{ fontStyle: "normal", color: "var(--gold)" }}>You decide.</em></h2>
            <p className="lead" style={{ marginTop: 14 }}>Telling you to buy or sell is unlicensed advice — so LensAI never does. Every read lands on one of three stances, with both cases on the table.</p>
          </Reveal>
        </div>
        <Stagger className="stances" gap={0.08}>
          {STANCE.map((s) => (
            <Item key={s.t} className="stance" variant="rise">
              <span className={`stamp ${s.c}`}><b>{s.t}</b></span>
              <p>{s.p}</p>
            </Item>
          ))}
        </Stagger>
      </section>

      {/* §04 ON THE RECORD */}
      <section className="lp-wrap lp-section" id="record">
        <div className="sec-head">
          <Reveal variant="rise"><div className="sec-ref"><span className="n">§04</span>On the record</div></Reveal>
          <Reveal variant="focus" delay={0.05}>
            <h2 className="display h2">Your keys. Your data. <em style={{ fontStyle: "normal", color: "var(--gold)" }}>Your call.</em></h2>
          </Reveal>
        </div>
        <Stagger className="record" gap={0.09}>
          {RECORD.map((r) => (
            <Item key={r.k} className="rec" variant="focus">
              <div className="k">{r.k}</div>
              <h4>{r.h}</h4>
              <p>{r.p}</p>
            </Item>
          ))}
        </Stagger>
      </section>

      {/* CLOSE */}
      <section className="lp-wrap close">
        <Reveal variant="focus">
          <div className="big">Bring any token <em>into focus.</em></div>
        </Reveal>
        <Reveal variant="rise" delay={0.1}>
          <div style={{ marginTop: 30, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/app" style={{ textDecoration: "none" }}>
              <button className="btn btn-primary"><span>Open the desk</span><span className="arw">→</span></button>
            </Link>
            <span className="code">2 free reads · no card</span>
          </div>
        </Reveal>
      </section>

      <footer className="lp-footer lp-wrap">
        <div className="row">
          <Link className="brand" href="/"><span className="glyph" /><span className="wm">LensAI</span></Link>
          <div className="meta">© 2026 · Information and analysis, not financial advice.</div>
        </div>
      </footer>
    </div>
  );
}
