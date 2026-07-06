"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useMotionValueEvent, useReducedMotion } from "framer-motion";
import { Reveal, SmoothScroll } from "@/components/motion";
import "./landing.css";

const EASE = [0.16, 1, 0.3, 1] as const;
const pad = (n: number) => String(n).padStart(2, "0");

// Popular assets — real brand colours + a one-line crux for the spotlight.
const COINS = [
  { s: "BTC", n: "Bitcoin", c: "#f7931a", g: "₿", d: false, price: "$62,578.74", chg: "+5.22%", up: true, v: "pos", vt: "POSITIVE", mcap: "$1.25T", rank: "#01",
    crux: "Digital gold — the reserve asset of crypto. Deepest liquidity, hardest supply, the benchmark every other token is measured against." },
  { s: "ETH", n: "Ethereum", c: "#627eea", g: "Ξ", d: false, price: "$1,770.52", chg: "+12.81%", up: true, v: "pos", vt: "POSITIVE", mcap: "$214B", rank: "#02",
    crux: "The settlement layer for programmable money. Fees burn with usage; staking secures the network and pays the holders who lock it up." },
  { s: "SOL", n: "Solana", c: "linear-gradient(135deg,#14f195,#9945ff)", g: "◎", d: false, price: "$80.98", chg: "+13.61%", up: true, v: "mix", vt: "MIXED", mcap: "$47B", rank: "#07",
    crux: "A high-throughput L1 built for speed. Real usage and real outages — the market keeps pricing both at the same time." },
  { s: "BNB", n: "BNB", c: "#f3ba2f", g: "◆", d: true, price: "$584.20", chg: "+2.10%", up: true, v: "pos", vt: "POSITIVE", mcap: "$85B", rank: "#04",
    crux: "The exchange-backed chain. Utility tied to the largest venue in crypto — with exactly the centralisation that implies." },
  { s: "XRP", n: "XRP", c: "#3b4b57", g: "✕", d: false, price: "$0.5240", chg: "−1.20%", up: false, v: "mix", vt: "MIXED", mcap: "$29B", rank: "#06",
    crux: "Built for cross-border settlement — fast and cheap to move. Its story still rides largely on regulatory outcomes." },
  { s: "DOGE", n: "Dogecoin", c: "#c2a633", g: "Ð", d: true, price: "$0.0612", chg: "−1.80%", up: false, v: "neg", vt: "NEGATIVE", mcap: "$8.8B", rank: "#09",
    crux: "The original memecoin. Liquidity and culture, not fundamentals — momentum and attention are the whole thesis." },
  { s: "LINK", n: "Chainlink", c: "#2a5ada", g: "⬡", d: false, price: "$11.42", chg: "+4.10%", up: true, v: "pos", vt: "POSITIVE", mcap: "$7.1B", rank: "#14",
    crux: "The oracle layer feeding real-world data into contracts. Quiet infrastructure the rest of DeFi depends on." },
  { s: "AVAX", n: "Avalanche", c: "#e84142", g: "▲", d: false, price: "$18.70", chg: "+6.90%", up: true, v: "pos", vt: "POSITIVE", mcap: "$7.4B", rank: "#12",
    crux: "A fast smart-contract platform with subnets for app-specific chains. Throughput to spare, a smaller moat to defend." },
] as const;
type Coin = (typeof COINS)[number];

const SPK: Record<string, number[]> = {
  pos: [40, 42, 41, 44, 43, 47, 45, 44, 49, 48, 52, 50, 55, 53, 58, 57, 61, 64],
  mix: [50, 48, 52, 49, 54, 51, 56, 53, 58, 55, 60, 57, 62, 59, 63, 60, 64, 61],
  neg: [62, 60, 57, 59, 54, 56, 52, 50, 53, 49, 51, 47, 49, 45, 47, 44, 46, 42],
};

// The instrument scans across these live — each ships the signal messages
// the desk surfaces about it (bullish / mixed / bearish observations).
const TOKENS = [
  { sym: "BTC", name: "Bitcoin", c: "#f7931a", g: "₿", d: false, price: "$62,578.74", c7: "+5.22%", up7: true, mcap: "$1.25T", v: "pos", vt: "POSITIVE", conf: "78%",
    spark: [40, 41, 39, 43, 42, 46, 44, 43, 48, 47, 51, 49, 54, 52, 57, 56, 60, 63],
    notes: [
      { t: "pos", m: "Exchange reserves at a multi-year low" },
      { t: "pos", m: "Spot volume up 18% over 24h" },
      { t: "mix", m: "Funding elevated — positioning looks crowded" },
      { t: "pos", m: "Long-term holders still net accumulating" },
    ] },
  { sym: "ETH", name: "Ethereum", c: "#627eea", g: "Ξ", d: false, price: "$1,770.52", c7: "+12.81%", up7: true, mcap: "$214B", v: "pos", vt: "POSITIVE", conf: "71%",
    spark: [30, 32, 31, 35, 34, 38, 40, 39, 44, 47, 49, 52, 55, 58, 60, 62, 64, 66],
    notes: [
      { t: "pos", m: "Staking ratio ticks to a new high" },
      { t: "pos", m: "L2 activity up 22% this week" },
      { t: "mix", m: "ETF flows flat week-over-week" },
      { t: "pos", m: "Burn is outpacing issuance again" },
    ] },
  { sym: "SOL", name: "Solana", c: "linear-gradient(135deg,#14f195,#9945ff)", g: "◎", d: false, price: "$80.98", c7: "+13.61%", up7: true, mcap: "$47B", v: "mix", vt: "MIXED", conf: "58%",
    spark: [50, 48, 52, 49, 54, 51, 56, 53, 58, 55, 60, 57, 62, 59, 63, 60, 64, 61],
    notes: [
      { t: "pos", m: "Leads every chain in DEX volume" },
      { t: "mix", m: "Network stability still a cited risk" },
      { t: "neg", m: "A token unlock cliff is approaching" },
      { t: "mix", m: "Desks split on the current valuation" },
    ] },
  { sym: "PEPE", name: "Pepe", c: "#4aa544", g: "P", d: false, price: "$0.00000269", c7: "+14.47%", up7: true, mcap: "$1.13B", v: "neg", vt: "NEGATIVE", conf: "41%",
    spark: [62, 60, 57, 59, 54, 56, 52, 50, 53, 49, 51, 47, 49, 45, 47, 44, 46, 42],
    notes: [
      { t: "neg", m: "Liquidity thins out below spot" },
      { t: "neg", m: "Top-10 wallets hold an outsized share" },
      { t: "mix", m: "Social volume spiking — momentum only" },
      { t: "neg", m: "No fundamental catalyst found" },
    ] },
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

/** Circular asset chip. Defaults to a brand-coloured glyph badge, then probes
 *  /public/coins/<ticker>.png after mount and upgrades to the real logo if it
 *  exists — so it looks clean now and auto-upgrades when PNGs are dropped in. */
function CoinLogo({
  sym, name, color, glyph, dark, size = 46, cls, glow,
}: { sym: string; name: string; color: string; glyph: string; dark?: boolean; size?: number; cls?: string; glow?: boolean }) {
  const [ok, setOk] = useState(false); // real PNG confirmed to load
  const src = `/coins/${sym.toLowerCase()}.png`;
  useEffect(() => {
    const im = new window.Image();
    im.onload = () => setOk(true);
    im.src = src;
  }, [src]);
  const tint = color.startsWith("#") ? `${color}59` : "#9945ff55";
  return (
    <span
      className={`coin ${cls ?? ""}`}
      style={{
        width: size, height: size, fontSize: Math.round(size * 0.42),
        background: ok ? "transparent" : color,
        color: dark ? "#0b0b12" : "#fff",
        boxShadow: glow ? `0 40px 120px -30px ${tint}, 0 0 0 1px rgba(255,255,255,0.05)` : undefined,
      }}
    >
      {ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: "50%" }} />
      ) : (
        <span>{glyph}</span>
      )}
    </span>
  );
}

/** Hero right panel — a coin's read with signal notifications popping in,
 *  then the whole deck fades and the next asset takes the stage. */
function SignalDeck() {
  const reduce = useReducedMotion();
  const [ci, setCi] = useState(0);
  const [shown, setShown] = useState(0);
  const t = TOKENS[ci];

  useEffect(() => {
    if (reduce) { setShown(t.notes.length); return; }
    setShown(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    t.notes.forEach((_, k) => timers.push(setTimeout(() => setShown(k + 1), 640 + k * 760)));
    const end = 640 + t.notes.length * 760 + 1750;
    timers.push(setTimeout(() => setCi((x) => (x + 1) % TOKENS.length), end));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ci, reduce]);

  return (
    <motion.div className="deck" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.85, delay: 0.55, ease: EASE }}>
      <div className="deck-top">
        <span className="lbl">Signal desk</span>
        <span className="live">◉ LIVE</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={t.sym}
          initial={{ opacity: 0, filter: "blur(10px)", y: 10 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          exit={{ opacity: 0, filter: "blur(10px)", y: -8 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="deck-id">
            <CoinLogo sym={t.sym} name={t.name} color={t.c} glyph={t.g} dark={t.d} size={38} />
            <div>
              <div className="px">{t.price}</div>
              <div className="nm">{t.name} · {t.sym}</div>
            </div>
            <span className={`chg ${t.up7 ? "up" : "dn"}`}>{t.c7}</span>
          </div>

          <svg className="dsig" viewBox="0 0 300 44" preserveAspectRatio="none">
            <path d={sparkPath(t.spark)} fill="none" stroke={sigColor(t.v)} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          </svg>

          <div className="deck-feed">
            <AnimatePresence>
              {t.notes.slice(0, shown).map((n, k) => (
                <motion.div
                  key={`${t.sym}-${k}`}
                  className={`toast ${n.t}`}
                  layout
                  initial={{ opacity: 0, x: 16, filter: "blur(6px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.42, ease: EASE }}
                >
                  <span className="dot" />
                  <span className="m">{n.m}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="deck-foot">
            <span className={`stamp ${t.v}`}>{t.vt}</span>
            <span className="conf">conf {t.conf} · mcap {t.mcap}</span>
          </div>
        </motion.div>
      </AnimatePresence>
      <div className="dots">
        {TOKENS.map((tk, k) => <span key={tk.sym} className={k === ci ? "on" : ""} />)}
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

/** Scroll spotlight — the stage dims, each asset's logo enlarges to half the
 *  screen while its crux fades in beside it; the next asset takes over on scroll. */
function Spotlight() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [i, setI] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setI(Math.min(COINS.length - 1, Math.max(0, Math.floor(v * COINS.length))));
  });
  const t = COINS[i];
  const tint = t.c.startsWith("#") ? t.c : "#9945ff";

  return (
    <section className="spotlight" ref={ref}>
      <div className="sp-sticky">
        <motion.div
          className="sp-tint"
          animate={{ background: `radial-gradient(760px 620px at 26% 46%, ${tint}2e, transparent 62%)` }}
          transition={{ duration: 0.7, ease: EASE }}
        />
        <div className="sp-inner lp-wrap">
          <div className="sp-head">
            <span className="kicker">The signal desk — always watching</span>
            <span className="cnt">{pad(i + 1)} / {pad(COINS.length)}</span>
          </div>

          <div className="sp-stage">
            <div className="sp-logo-col">
              <AnimatePresence mode="wait">
                <motion.div
                  key={t.s}
                  className="sp-logo"
                  initial={{ opacity: 0, scale: 0.68, filter: "blur(14px)" }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, scale: 0.9, filter: "blur(14px)" }}
                  transition={{ duration: 0.55, ease: EASE }}
                >
                  <CoinLogo sym={t.s} name={t.n} color={t.c} glyph={t.g} dark={t.d} size={340} glow cls="huge" />
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="sp-crux-col">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${t.s}c`}
                  className="sp-crux"
                  initial={{ opacity: 0, x: 30, filter: "blur(8px)" }}
                  animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, x: -18, filter: "blur(8px)" }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  <div className="tk">{t.n} <span>· {t.s}</span></div>
                  <p className="crux">{t.crux}</p>
                  <div className="facts">
                    <div><span>PRICE</span><b>{t.price}</b></div>
                    <div><span>7D</span><b className={t.up ? "up" : "dn"}>{t.chg}</b></div>
                    <div><span>MARKET CAP</span><b>{t.mcap}</b></div>
                    <div><span>RANK</span><b>{t.rank}</b></div>
                  </div>
                  <span className={`stamp ${t.v}`}>ASSESSMENT · {t.vt}</span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="sp-rail">
            {COINS.map((c, k) => (
              <CoinLogo key={c.s} sym={c.s} name={c.n} color={c.c} glyph={c.g} dark={c.d} size={42} cls={k === i ? "on" : ""} />
            ))}
          </div>
          <div className="sp-progress"><motion.i style={{ scaleX: scrollYProgress, transformOrigin: "0 0", position: "absolute", inset: 0, background: tint }} /></div>
        </div>
      </div>
    </section>
  );
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

export default function Landing() {
  return (
    <SmoothScroll>
      <Inner />
    </SmoothScroll>
  );
}

function Inner() {
  const [stuck, setStuck] = useState(false);
  const [light, setLight] = useState(true);
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

        <div className="hero-lower">
          <motion.div className="col" {...load(0.2)}>
            <h1 className="display">
              Read the signal,<br /><span className="dim">not the noise.</span>
            </h1>
            <p>A research instrument for crypto. Point it at any token and get a decision-grade read from live data and current news — the assessment, the reasoning, both sides. Never a buy button.</p>
            <motion.div className="hero-rail" {...load(0.42)}>
              <span className="lbl">Tracking 200+ assets ↓</span>
              <div className="coins">{COINS.map((c) => (
                <CoinLogo key={c.s} sym={c.s} name={c.n} color={c.c} glyph={c.g} dark={c.d} size={46} />
              ))}</div>
            </motion.div>
            <div className="cta">
              <Link className="tlink" href="/app"><span>Analyze a token</span><span className="a">→</span></Link>
            </div>
          </motion.div>

          <SignalDeck />
        </div>
      </header>

      <Spotlight />
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
