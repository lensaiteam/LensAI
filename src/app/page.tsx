"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useTransform, useMotionValueEvent, useReducedMotion } from "framer-motion";
import { Reveal, SmoothScroll } from "@/components/motion";
import "./landing.css";

const EASE = [0.16, 1, 0.3, 1] as const;
const pad = (n: number) => String(n).padStart(2, "0");

// Popular assets — brand colour, a one-line crux, and the kind of questions a
// user actually asks about each (spawned as message bubbles on the stage).
const COINS = [
  { s: "BTC", n: "Bitcoin", c: "#f7931a", g: "₿", d: false, price: "$62,578.74", chg: "+5.22%", up: true, v: "pos", vt: "POSITIVE", mcap: "$1.25T", rank: "#01",
    crux: "Digital gold — the reserve asset of crypto. Deepest liquidity, hardest supply, the benchmark every other token is measured against.",
    qs: ["Is the rally overheated?", "Who's still accumulating?", "How deep is liquidity?", "What could break the trend?"] },
  { s: "ETH", n: "Ethereum", c: "#627eea", g: "Ξ", d: false, price: "$1,770.52", chg: "+12.81%", up: true, v: "pos", vt: "POSITIVE", mcap: "$214B", rank: "#02",
    crux: "The settlement layer for programmable money. Fees burn with usage; staking secures the network and pays the holders who lock it up.",
    qs: ["Is staking crowding out yield?", "Are L2s eating fees?", "How's ETF demand?", "Is the burn sustainable?"] },
  { s: "SOL", n: "Solana", c: "linear-gradient(135deg,#14f195,#9945ff)", g: "◎", d: false, price: "$80.98", chg: "+13.61%", up: true, v: "mix", vt: "MIXED", mcap: "$47B", rank: "#07",
    crux: "A high-throughput L1 built for speed. Real usage and real outages — the market keeps pricing both at the same time.",
    qs: ["Will outages return?", "When's the next unlock?", "Is the valuation stretched?", "Is the activity real?"] },
  { s: "BNB", n: "BNB", c: "#f3ba2f", g: "◆", d: true, price: "$584.20", chg: "+2.10%", up: true, v: "pos", vt: "POSITIVE", mcap: "$85B", rank: "#04",
    crux: "The exchange-backed chain. Utility tied to the largest venue in crypto — with exactly the centralisation that implies.",
    qs: ["How centralised is it?", "Does exchange risk bleed in?", "Where's demand coming from?", "What's the burn doing?"] },
  { s: "XRP", n: "XRP", c: "#3b4b57", g: "✕", d: false, price: "$0.5240", chg: "−1.20%", up: false, v: "mix", vt: "MIXED", mcap: "$29B", rank: "#06",
    crux: "Built for cross-border settlement — fast and cheap to move. Its story still rides largely on regulatory outcomes.",
    qs: ["Where does the case stand?", "Who actually uses it?", "Is supply an overhang?", "Is it liquid enough?"] },
  { s: "DOGE", n: "Dogecoin", c: "#c2a633", g: "Ð", d: true, price: "$0.0612", chg: "−1.80%", up: false, v: "neg", vt: "NEGATIVE", mcap: "$8.8B", rank: "#09",
    crux: "The original memecoin. Liquidity and culture, not fundamentals — momentum and attention are the whole thesis.",
    qs: ["Anything but momentum?", "Who holds the big bags?", "What if attention fades?", "Any real utility?"] },
  { s: "LINK", n: "Chainlink", c: "#2a5ada", g: "⬡", d: false, price: "$11.42", chg: "+4.10%", up: true, v: "pos", vt: "POSITIVE", mcap: "$7.1B", rank: "#14",
    crux: "The oracle layer feeding real-world data into contracts. Quiet infrastructure the rest of DeFi depends on.",
    qs: ["Who depends on it?", "Is demand growing?", "How's token capture?", "Any rivals closing in?"] },
  { s: "AVAX", n: "Avalanche", c: "#e84142", g: "▲", d: false, price: "$18.70", chg: "+6.90%", up: true, v: "pos", vt: "POSITIVE", mcap: "$7.4B", rank: "#12",
    crux: "A fast smart-contract platform with subnets for app-specific chains. Throughput to spare, a smaller moat to defend.",
    qs: ["How wide is the moat?", "Are subnets gaining users?", "Where's the liquidity?", "What's the catalyst?"] },
] as const;
type Coin = (typeof COINS)[number];

const SPK: Record<string, number[]> = {
  pos: [40, 42, 41, 44, 43, 47, 45, 44, 49, 48, 52, 50, 55, 53, 58, 57, 61, 64],
  mix: [50, 48, 52, 49, 54, 51, 56, 53, 58, 55, 60, 57, 62, 59, 63, 60, 64, 61],
  neg: [62, 60, 57, 59, 54, 56, 52, 50, 53, 49, 51, 47, 49, 45, 47, 44, 46, 42],
};

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
  const [ok, setOk] = useState(false);
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
        boxShadow: glow ? `0 50px 130px -34px ${tint}, 0 0 0 1px rgba(255,255,255,0.04)` : undefined,
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

// Where question bubbles spawn — hugging the gutters, clear of the portrait.
const QPOS: Array<Record<string, string>> = [
  { left: "5%", top: "29%" },
  { right: "5%", top: "23%" },
  { left: "8%", top: "60%" },
  { right: "7%", top: "58%" },
];

/** Questions that "someone is asking" — spawn at random-ish spots per asset. */
function Questions({ coin }: { coin: Coin }) {
  const reduce = useReducedMotion();
  return (
    <div className="stage-questions" aria-hidden>
      {coin.qs.map((q, k) => (
        <motion.div
          key={`${coin.s}-${k}`}
          className="qbubble"
          style={{ ...QPOS[k % QPOS.length], "--qc": sigColor(coin.v) } as React.CSSProperties}
          initial={{ opacity: 0, scale: 0.82, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.45, delay: reduce ? 0 : 0.2 + k * 0.26, ease: EASE }}
        >
          <span className="qdot" />{q}
        </motion.div>
      ))}
    </div>
  );
}

/** The hero IS the experience: a centered headline over a row of real logos;
 *  on scroll it becomes a character-select — each asset enlarges in turn with
 *  its details overlaid and questions spawning around it. */
function Stage() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const [i, setI] = useState(0);
  const [active, setActive] = useState(false);

  const INTRO = 0.13;
  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setActive(v > INTRO * 0.55);
    const sp = Math.max(0, (v - INTRO) / (1 - INTRO));
    setI(Math.min(COINS.length - 1, Math.floor(sp * COINS.length)));
  });

  const headOp = useTransform(scrollYProgress, [0, INTRO * 0.8], [1, 0]);
  const headY = useTransform(scrollYProgress, [0, INTRO], [0, -46]);
  const railTop = useTransform(scrollYProgress, [0, INTRO], ["64%", "80%"]);
  const railScale = useTransform(scrollYProgress, [0, INTRO], [1, 0.82]);

  const t = COINS[i];
  const tint = t.c.startsWith("#") ? t.c : "#9945ff";

  return (
    <section className="stage" ref={ref}>
      <div className="stage-sticky">
        <motion.div
          className="stage-tint"
          animate={{ opacity: active ? 1 : 0, background: `radial-gradient(720px 600px at 50% 40%, ${tint}24, transparent 60%)` }}
          transition={{ duration: 0.6, ease: EASE }}
        />

        {/* Intro — centered headline (only visible at the top of the scroll) */}
        <motion.div
          className="stage-intro"
          animate={{ opacity: active ? 0 : 1, y: active ? -44 : 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          style={{ pointerEvents: active ? "none" : "auto" }}
        >
          <span className="kicker">LensAI — Crypto Intelligence</span>
          <h1 className="display">Read the signal,<br /><span className="dim">not the noise.</span></h1>
          <div className="scrollhint mono">Scroll to scan the market ↓</div>
        </motion.div>

        {/* Focus — the selected asset enlarges with details + questions */}
        <motion.div className="stage-focus" animate={{ opacity: active ? 1 : 0 }} transition={{ duration: 0.5, ease: EASE }} style={{ pointerEvents: active ? "auto" : "none" }}>
          <div className="stage-portrait">
            <AnimatePresence mode="wait">
              <motion.div
                key={t.s}
                initial={{ opacity: 0, scale: 0.62, filter: "blur(16px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.85, filter: "blur(16px)" }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <CoinLogo sym={t.s} name={t.n} color={t.c} glyph={t.g} dark={t.d} size={220} glow cls="big" />
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="stage-detail">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${t.s}d`}
                initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -12, filter: "blur(8px)" }}
                transition={{ duration: 0.45, ease: EASE }}
              >
                <div className="tk display">{t.n} <span>· {t.s}</span></div>
                <p className="crux">{t.crux}</p>
                <div className="facts">
                  <div><span>PRICE</span><b>{t.price}</b></div>
                  <div><span>7D</span><b className={t.up ? "up" : "dn"}>{t.chg}</b></div>
                  <div><span>MCAP</span><b>{t.mcap}</b></div>
                  <div><span>RANK</span><b>{t.rank}</b></div>
                </div>
                <span className={`stamp ${t.v}`}>ASSESSMENT · {t.vt}</span>
              </motion.div>
            </AnimatePresence>
          </div>

          <Questions key={t.s} coin={t} />
        </motion.div>

        {/* The select tray — the same logos, always present */}
        <motion.div className={`stage-rail${active ? " sel" : ""}`} style={{ top: railTop, scale: railScale }}>
          {COINS.map((c, k) => (
            <CoinLogo key={c.s} sym={c.s} name={c.n} color={c.c} glyph={c.g} dark={c.d} size={56} cls={active && k === i ? "on" : ""} />
          ))}
        </motion.div>

        <div className="stage-counter mono">{active ? `${pad(i + 1)} / ${pad(COINS.length)}` : "SELECT AN ASSET"}</div>
        <div className="stage-progress"><motion.i style={{ scaleX: scrollYProgress, transformOrigin: "0 0", position: "absolute", inset: 0, background: tint }} /></div>
      </div>
    </section>
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

const READ = [
  ["0.1", "Snapshot", "Price, market cap, 24h/7d, volume and supply — the state of the asset."],
  ["0.2", "Tokenomics", "Supply model, holder concentration and unlock risk."],
  ["0.3", "Developments", "Recent catalysts and the tone of coverage, each attributed."],
  ["0.4", "Risk flags", "Liquidity, volatility and security — surfaced green, amber, red."],
  ["0.5", "Overall read", "An honest synthesis, with follow-ups from the same gathered data."],
];
const BRIEF = [
  ["0.1", "Snapshot", "pos"], ["0.2", "Tokenomics", "pos"], ["0.3", "Developments", "mix"],
  ["0.4", "Sentiment", "pos"], ["0.5", "Risk flags", "mix"], ["0.6", "Overall read", "pos"],
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

      {/* HERO + character-select stage */}
      <Stage />
      <Tape />

      {/* §01 THE READ — with a live sample-briefing preview */}
      <section className="lp-wrap sec" id="read">
        <div className="sec-grid">
          <Reveal className="sec-num" variant="rise">01 / The read<span className="big">01</span></Reveal>
          <div className="sec-body">
            <Reveal variant="rise"><h2 className="display">Every read is a briefing, <span className="dim">not a number.</span></h2></Reveal>
            <Reveal variant="rise" delay={0.05}><p className="intro">One pass produces six attributed sections. The expensive part — gathering live data and news — happens once and is cached, so popular tokens return instantly.</p></Reveal>
            <div className="read-split">
              <div className="nlist">
                {READ.map(([n, h, p], i) => (
                  <Reveal key={n} variant="rise" delay={0.03 * i}>
                    <div className="nrow"><div className="n">{n}</div><div><h3>{h}</h3><p>{p}</p></div></div>
                  </Reveal>
                ))}
              </div>
              <Reveal variant="rise" delay={0.06} className="brief-wrap">
                <div className="brief">
                  <div className="brief-top"><span className="mono">BRIEFING · BTC</span><span className="stamp pos">POSITIVE</span></div>
                  <svg className="brief-sig" viewBox="0 0 300 44" preserveAspectRatio="none"><path d={sparkPath(SPK.pos)} fill="none" stroke="var(--pos)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg>
                  {BRIEF.map(([n, h, s]) => (
                    <div className="brief-row" key={n}><span className="mono bn">{n}</span><span className="bh">{h}</span><i className={`bd ${s}`} /></div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* §02 METHOD — with a pipeline diagram */}
      <section className="lp-wrap sec" id="method">
        <div className="sec-grid">
          <Reveal className="sec-num" variant="rise">02 / Method<span className="big">02</span></Reveal>
          <div className="sec-body">
            <Reveal variant="rise"><h2 className="display">Point the instrument. <span className="dim">Get a read.</span></h2></Reveal>
            <Reveal variant="rise" delay={0.05} className="pipe">
              {STEPS.map(([n, h], k) => (
                <div className="pipe-node" key={n}>
                  <span className="pipe-n mono">{n}</span>
                  <span className="pipe-h">{h}</span>
                  {k < STEPS.length - 1 && <span className="pipe-arrow">→</span>}
                </div>
              ))}
            </Reveal>
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
