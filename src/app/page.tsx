"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useMotionValueEvent, useReducedMotion } from "framer-motion";
import { Reveal, SmoothScroll } from "@/components/motion";
import "./landing.css";

const EASE = [0.16, 1, 0.3, 1] as const;

// The instrument scans across these live (hero read cycles through them).
const TOKENS = [
  { sym: "BTC", name: "Bitcoin", price: "$62,578.74", c24: "−0.46%", up24: false, c7: "+5.22%", up7: true, mcap: "$1.25T", rank: "#01", v: "pos", vt: "POSITIVE", conf: "78%", spark: [40, 41, 39, 43, 42, 46, 44, 43, 48, 47, 51, 49, 54, 52, 57, 56, 60, 63] },
  { sym: "ETH", name: "Ethereum", price: "$1,770.52", c24: "−0.84%", up24: false, c7: "+12.81%", up7: true, mcap: "$214B", rank: "#02", v: "pos", vt: "POSITIVE", conf: "71%", spark: [30, 32, 31, 35, 34, 38, 40, 39, 44, 47, 49, 52, 55, 58, 60, 62, 64, 66] },
  { sym: "SOL", name: "Solana", price: "$80.98", c24: "−1.41%", up24: false, c7: "+13.61%", up7: true, mcap: "$47B", rank: "#07", v: "mix", vt: "MIXED", conf: "58%", spark: [50, 48, 52, 49, 54, 51, 56, 53, 58, 55, 60, 57, 62, 59, 63, 60, 64, 61] },
  { sym: "PEPE", name: "Pepe", price: "$0.00000269", c24: "−3.24%", up24: false, c7: "+14.47%", up7: true, mcap: "$1.13B", rank: "#64", v: "neg", vt: "NEGATIVE", conf: "41%", spark: [62, 60, 57, 59, 54, 56, 52, 50, 53, 49, 51, 47, 49, 45, 47, 44, 46, 42] },
];

const TAPE = [
  ["BTC", "$62,578", "+5.2%", 1], ["ETH", "$1,770", "+12.8%", 1], ["SOL", "$80.98", "+13.6%", 1],
  ["ARB", "$0.078", "−2.5%", 0], ["LINK", "$11.42", "+4.1%", 1], ["JUP", "$0.24", "+14.1%", 1],
  ["DOGE", "$0.061", "−1.8%", 0], ["AVAX", "$18.7", "+6.9%", 1], ["PEPE", "$0.0000027", "−3.2%", 0],
  ["UNI", "$7.31", "+2.4%", 1], ["TIA", "$5.02", "+9.7%", 1], ["SEI", "$0.31", "−1.1%", 0],
] as const;

function sparkPath(spark: number[]) {
  const W = 300, H = 44, max = Math.max(...spark), min = Math.min(...spark);
  return spark.map((val, i) => {
    const x = (i / (spark.length - 1)) * W;
    const y = H - 4 - ((val - min) / (max - min || 1)) * (H - 8);
    return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}
function sigColor(v: string) {
  return v === "neg" ? "var(--neg)" : v === "mix" ? "var(--warn)" : "var(--pos)";
}

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

/** The hero read — the instrument scans across tokens live (its heartbeat). */
function LiveRead() {
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setI((x) => (x + 1) % TOKENS.length), 4200);
    return () => clearInterval(id);
  }, [reduce]);
  const t = TOKENS[i];

  return (
    <motion.div className="read" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, delay: 0.6, ease: EASE }}>
      <div className="rt">
        <span className="lbl">Reading · Lens/0{i + 1}</span>
        <span className="live">◉ LIVE</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={t.sym}
          initial={{ opacity: 0, filter: "blur(8px)", y: 8 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          exit={{ opacity: 0, filter: "blur(8px)", y: -6 }}
          transition={{ duration: 0.45, ease: EASE }}
        >
          <div className="px">{t.price}</div>
          <div className="nm">{t.name} · {t.sym}</div>
          <svg className="rsig" viewBox="0 0 300 44" preserveAspectRatio="none">
            <path className="line" d={sparkPath(t.spark)} fill="none" stroke={sigColor(t.v)} strokeWidth="1.4" pathLength={1} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="kv"><span>24H</span><span className={t.up24 ? "up" : "dn"}>{t.c24}</span></div>
          <div className="kv"><span>7D</span><span className={t.up7 ? "up" : "dn"}>{t.c7}</span></div>
          <div className="kv"><span>MARKET CAP</span><span>{t.mcap}</span></div>
          <div className="kv"><span>RANK</span><span>{t.rank}</span></div>
          <div className="verdict">
            <span className={`stamp ${t.v}`}>ASSESSMENT · {t.vt}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--mut)" }}>conf {t.conf}</span>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="dots">
        {TOKENS.map((tk, k) => <span key={tk.sym} className={k === i ? "on" : ""} />)}
      </div>
    </motion.div>
  );
}

/** Live market tape — ambient motion, real content. */
function Tape() {
  const seg = [...TAPE, ...TAPE].map((t, k) => (
    <span className="seg" key={k}><b>{t[0]}</b> {t[1]} <span className={t[3] ? "up" : "dn"}>{t[2]}</span></span>
  ));
  return (
    <div className="tape" aria-hidden>
      <div className="trow">{seg}</div>
    </div>
  );
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

          <LiveRead />
        </div>
      </header>

      <Tape />

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
