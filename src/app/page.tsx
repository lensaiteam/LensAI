"use client";
import { useState } from "react";
import Link from "next/link";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { Reveal, SmoothScroll } from "@/components/motion";
import "./landing.css";

const EASE = [0.16, 1, 0.3, 1] as const;

const READ = [
  ["0.1", "Snapshot", "Price, market cap, 24h/7d, volume and supply — the state of the asset."],
  ["0.2", "Tokenomics", "Supply model, holder concentration and unlock risk."],
  ["0.3", "Developments & sentiment", "Recent catalysts and the tone of coverage, each attributed."],
  ["0.4", "Risk flags", "Liquidity, volatility and security — surfaced green, amber, red."],
  ["0.5", "Overall read", "An honest synthesis, with follow-ups from the same gathered data."],
];
const STEPS = [
  ["01", "Resolve", "Type any ticker or address. Resolved across Coinbase and CoinGecko — or flagged plainly if it can't be."],
  ["02", "Gather", "Live price, volume, supply and current news, read in real time. The pipeline is the product."],
  ["03", "Assess", "A decision-grade briefing with an honest POSITIVE / MIXED / NEGATIVE call — both cases, no buy button."],
];
const STANCE = [
  ["neg", "NEGATIVE", "Thin liquidity, concentration, red flags — or a token we can't verify, said plainly."],
  ["mix", "MIXED", "Real strengths against real risks. We hold the tension rather than resolve it for you."],
  ["pos", "POSITIVE", "Strong fundamentals, healthy liquidity, constructive flow — the bear case still named."],
];
const ACCESS = [
  ["A.1", "Sign in with a signature", "Prove you own your wallet by signing a message. No transaction, no gas, no keys on our servers."],
  ["A.2", "The address is the account", "No email, no password, no PII. Just your wallet — and two free reads to begin."],
  ["A.3", "Erased on request", "One action removes your account and every session. Crypto-native by default."],
];

export default function Landing() {
  return (
    <SmoothScroll>
      <Inner />
    </SmoothScroll>
  );
}

function Inner() {
  const [stuck, setStuck] = useState(false);
  const [light, setLight] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (v) => setStuck(v > 40));

  const load = (d: number) => ({
    initial: { opacity: 0, y: 18 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.85, delay: d, ease: EASE },
  });

  return (
    <div className={`lp${light ? " light" : ""}`}>
      {/* Nav */}
      <nav className={`lp-nav${stuck ? " stuck" : ""}`}>
        <Link className="brand" href="/"><span className="glyph" />LensAI</Link>
        <div className="lp-nav-right">
          <a className="navlink" href="#read">The read</a>
          <a className="navlink" href="#method">Method</a>
          <a className="navlink" href="#stance">Stance</a>
          <button className="tgl" onClick={() => setLight(!light)}>{light ? "Dark" : "Light"}</button>
          <Link className="tlink" href="/app"><span>Open the desk</span><span className="a">→</span></Link>
        </div>
      </nav>

      {/* HERO */}
      <header className="lp-wrap hero">
        <motion.div className="hero-top" {...load(0.1)}>
          <span className="kicker">LensAI — Crypto Intelligence</span>
          <span className="idx">NON-ADVISORY<br />EST. 2026</span>
        </motion.div>

        <motion.h1 className="display" {...load(0.2)}>
          Read the signal,<br /><span className="dim">not the noise.</span>
        </motion.h1>

        <div className="hero-lower">
          <motion.div className="col" {...load(0.5)}>
            <p>A research instrument for crypto. Point it at any token and get a decision-grade read from live data and current news — the assessment, the reasoning, both sides. Never a buy button.</p>
            <div className="cta">
              <Link className="tlink" href="/app"><span>Analyze a token</span><span className="a">→</span></Link>
            </div>
          </motion.div>

          <motion.div className="read" {...load(0.65)}>
            <div className="rt">
              <span className="lbl">Reading · Lens/01</span>
              <span className="live">◉ LIVE</span>
            </div>
            <div className="px">$62,578.74</div>
            <div className="nm">Bitcoin · BTC</div>
            <div style={{ marginTop: 16 }}>
              <div className="kv"><span>24H</span><span className="dn">−0.46%</span></div>
              <div className="kv"><span>7D</span><span className="up">+5.22%</span></div>
              <div className="kv"><span>MARKET CAP</span><span>$1.25T</span></div>
              <div className="kv"><span>RANK</span><span>#01</span></div>
            </div>
            <div className="verdict">
              <span className="stamp">ASSESSMENT · POSITIVE</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>conf 78%</span>
            </div>
          </motion.div>
        </div>
      </header>

      {/* §01 THE READ */}
      <section className="lp-wrap sec" id="read">
        <div className="sec-grid">
          <Reveal className="sec-num" variant="rise">01 / The read<span className="big">01</span></Reveal>
          <div className="sec-body">
            <Reveal variant="rise"><h2 className="display">Every read is a briefing, <span className="dim">not a number.</span></h2></Reveal>
            <Reveal variant="rise" delay={0.05}><p className="intro">One pass produces six attributed sections. The expensive part — gathering live data and news — happens once and is cached, so popular tokens return instantly.</p></Reveal>
            <div className="nlist">
              {READ.map(([n, h, p], i) => (
                <Reveal key={n} variant="rise" delay={0.03 * i}>
                  <div className="nrow"><div className="n">{n}</div><div><h3>{h}</h3><p>{p}</p></div></div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* §02 METHOD */}
      <section className="lp-wrap sec" id="method">
        <div className="sec-grid">
          <Reveal className="sec-num" variant="rise">02 / Method<span className="big">02</span></Reveal>
          <div className="sec-body">
            <Reveal variant="rise"><h2 className="display">Point the instrument. <span className="dim">Get a read.</span></h2></Reveal>
            <div className="steps">
              {STEPS.map(([n, h, p], i) => (
                <Reveal key={n} variant="rise" delay={0.04 * i}>
                  <div className="stepr"><div className="n">{n}</div><div><h3>{h}</h3><p>{p}</p></div></div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* §03 STANCE */}
      <section className="lp-wrap sec" id="stance">
        <div className="sec-grid">
          <Reveal className="sec-num" variant="rise">03 / Stance<span className="big">03</span></Reveal>
          <div className="sec-body">
            <Reveal variant="rise"><h2 className="display">We assess. <span className="dim">You decide.</span></h2></Reveal>
            <Reveal variant="rise" delay={0.05}><p className="intro">Telling you to buy or sell is unlicensed advice — so LensAI never does. Every read lands on one of three stances, with both cases on the table.</p></Reveal>
            <Reveal variant="rise" delay={0.1}>
              <div className="scale">
                <div className="track"><i style={{ left: "72%" }} /></div>
                <div className="nodes">
                  {STANCE.map(([c, t, p]) => (
                    <div className={`node ${c}`} key={t}><div className="t">{t}</div><p>{p}</p></div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* §04 ACCESS */}
      <section className="lp-wrap sec" id="access">
        <div className="sec-grid">
          <Reveal className="sec-num" variant="rise">04 / Access<span className="big">04</span></Reveal>
          <div className="sec-body">
            <Reveal variant="rise"><h2 className="display">Your keys. Your data. <span className="dim">Your call.</span></h2></Reveal>
            <div className="arows">
              {ACCESS.map(([n, h, p], i) => (
                <Reveal key={n} variant="rise" delay={0.03 * i}>
                  <div className="arow"><div className="n">{n}</div><div><h3>{h}</h3><p>{p}</p></div></div>
                </Reveal>
              ))}
            </div>
            <Reveal variant="rise" delay={0.1}>
              <div style={{ marginTop: 40 }}>
                <Link className="tlink" href="/app"><span>Open the desk</span><span className="a">→</span></Link>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* CLOSE */}
      <section className="lp-wrap close">
        <Reveal variant="rise"><h2 className="display">Bring any token <span className="dim">into focus.</span></h2></Reveal>
        <Reveal variant="rise" delay={0.08}>
          <Link className="tlink" href="/app"><span>Open the desk</span><span className="a">→</span></Link>
        </Reveal>
      </section>

      <footer className="lp-footer lp-wrap">
        <div className="row">
          <Link className="brand" href="/"><span className="glyph" />LensAI</Link>
          <div className="meta">© 2026 · Information and analysis, not financial advice.</div>
        </div>
      </footer>
    </div>
  );
}
