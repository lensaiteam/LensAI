"use client";
import { useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { motion, AnimatePresence } from "framer-motion";
import "./landing.css";

const EASE = [0.16, 1, 0.3, 1] as const;

const MODES = ["Overview", "The read", "Method", "Stance", "Access"];

const READ = [
  ["R·01", "Snapshot", "Price, market cap, 24h/7d, volume and supply — the state of the asset in tabular precision."],
  ["R·02", "Tokenomics", "Supply model, holder concentration and unlock risk — what the structure actually means."],
  ["R·03", "Developments", "Recent catalysts and the tone of coverage, each attributed to its source — not vibes."],
  ["R·04", "Risk flags", "Liquidity, volatility and security signals surfaced plainly: green, amber, red."],
  ["R·05", "Overall read", "An honest synthesis with the reasoning — and follow-ups from the same gathered data."],
];
const METHOD = [
  ["01 · RESOLVE", "Point the instrument", "Type any ticker or address. LensAI resolves it across Coinbase and CoinGecko — or says plainly if it can't."],
  ["02 · GATHER", "Pull the signal", "Live price, volume, supply and current news read in real time. The pipeline is the product."],
  ["03 · ASSESS", "Return the read", "A decision-grade briefing with an honest POSITIVE / MIXED / NEGATIVE call — both cases, no buy button."],
];
const STANCE = [
  ["pos", "POSITIVE", "Strong fundamentals, healthy liquidity, constructive flow — the bear case still named."],
  ["mix", "MIXED", "Real strengths against real risks. We hold the tension rather than resolve it for you."],
  ["neg", "NEGATIVE", "Thin liquidity, concentration, red flags — or a token we can't verify, said plainly."],
];
const ACCESS = [
  ["A signature, nothing more", "Prove you own your wallet by signing a message. No transaction, no gas, no keys on our servers."],
  ["The address is the account", "No email, no password, no PII. Just your wallet — and two free reads to begin."],
  ["Erased on request", "One action removes your account and every session. Crypto-native by default."],
];

const SPARK = [40, 41, 39, 43, 42, 46, 44, 43, 48, 47, 51, 49, 54, 52, 57, 56, 60, 63];
function sparkPath(fill: boolean) {
  const W = 300, H = 60, max = Math.max(...SPARK), min = Math.min(...SPARK);
  const d = SPARK.map((v, i) => {
    const x = (i / (SPARK.length - 1)) * W;
    const y = H - 5 - ((v - min) / (max - min)) * (H - 10);
    return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return fill ? `${d} L300 60 L0 60 Z` : d;
}

const eyeVar = {
  initial: { opacity: 0, filter: "blur(10px)", y: 10, scale: 1.006 },
  animate: { opacity: 1, filter: "blur(0px)", y: 0, scale: 1 },
  exit: { opacity: 0, filter: "blur(10px)", y: -6, scale: 0.996 },
};

export default function Landing() {
  const [mode, setMode] = useState(0);

  return (
    <div className="console">
      {/* Top strip */}
      <div className="cx-top">
        <Link className="brand" href="/">
          <span className="glyph" />
          <span className="wm">LensAI</span>
        </Link>
        <div className="mid">LENS/0{mode + 1} · {MODES[mode].toUpperCase()}</div>
        <div className="right">
          <span className="live">LIVE</span>
          <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
          <Link href="/app" className="btn btn-primary btn-sm"><span>Open desk</span></Link>
        </div>
      </div>

      {/* Control rail */}
      <nav className="cx-rail">
        <div className="rail-label">Channels</div>
        {MODES.map((m, i) => (
          <button key={m} className={`mode${i === mode ? " on" : ""}`} onClick={() => setMode(i)}>
            {i === mode && <motion.span layoutId="railmark" className="mk" transition={{ duration: 0.35, ease: EASE }} />}
            <span className="no">0{i + 1}</span>
            <span className="nm">{m}</span>
          </button>
        ))}
        <div className="rail-foot">
          <span className="code">STATUS · ONLINE</span>
          <span className="code">MODE · NON-ADVISORY</span>
          <span className="code">EST · 2026</span>
        </div>
      </nav>

      {/* Eyepiece */}
      <main className="cx-eye">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            className="eye-inner"
            variants={eyeVar}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.5, ease: EASE }}
          >
            <span className="rc tl" /><span className="rc tr" /><span className="rc bl" /><span className="rc br" />
            <div className="eye-ref">§ 0{mode + 1} · {MODES[mode].toUpperCase()}<span className="l" /></div>

            {mode === 0 && (
              <>
                <h1 className="eye-h">Read the <em>signal</em>,<br />not the noise.</h1>
                <p className="eye-sub">A research instrument for crypto. Point it at any token and get a decision-grade read from live data and current news — the assessment, the reasoning, both sides. Never a buy button.</p>
                <div className="eye-cta">
                  <Link href="/app" style={{ textDecoration: "none" }}>
                    <button className="btn btn-primary"><span>Analyze a token</span><span className="arw">→</span></button>
                  </Link>
                  <button className="btn btn-ghost" onClick={() => setMode(2)}><span>How it works</span></button>
                </div>
              </>
            )}

            {mode === 1 && (
              <>
                <h1 className="eye-h">Every read is a <em>briefing.</em></h1>
                <div className="eye-rows">
                  {READ.map(([i, h, p]) => (
                    <div className="r" key={i}><div className="i">{i}</div><div><h4>{h}</h4><p>{p}</p></div></div>
                  ))}
                </div>
              </>
            )}

            {mode === 2 && (
              <>
                <h1 className="eye-h">Point the instrument. <em>Get a read.</em></h1>
                <div className="eye-steps">
                  {METHOD.map(([k, h, p]) => (
                    <div className="s" key={k}><div className="k">{k}</div><h4>{h}</h4><p>{p}</p></div>
                  ))}
                </div>
              </>
            )}

            {mode === 3 && (
              <>
                <h1 className="eye-h">We assess. <em>You decide.</em></h1>
                <p className="eye-sub">Telling you to buy or sell is unlicensed advice — so LensAI never does. Every read lands on one of three stances, both cases on the table.</p>
                <div className="eye-stances">
                  {STANCE.map(([c, t, p]) => (
                    <div className="st" key={t}><span className={`stamp ${c}`}>{t}</span><p>{p}</p></div>
                  ))}
                </div>
              </>
            )}

            {mode === 4 && (
              <>
                <h1 className="eye-h">Your keys. Your data. <em>Your call.</em></h1>
                <div className="eye-rows">
                  {ACCESS.map(([h, p], i) => (
                    <div className="r" key={h}><div className="i">A·0{i + 1}</div><div><h4>{h}</h4><p>{p}</p></div></div>
                  ))}
                </div>
                <div className="eye-cta">
                  <Link href="/app" style={{ textDecoration: "none" }}>
                    <button className="btn btn-primary"><span>Open the desk</span><span className="arw">→</span></button>
                  </Link>
                  <span className="code" style={{ alignSelf: "center" }}>2 free reads · no card</span>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Telemetry */}
      <aside className="cx-tele">
        <div className="tele-h">
          <span className="t">Telemetry · Live feed</span>
          <span className="live" style={{ color: "var(--pos)" }}>◉</span>
        </div>
        <div className="tele-body">
          <div className="tele-asset">
            <div className="nm">BTC · Bitcoin</div>
            <div className="px">$62,578.74</div>
            <div className="chg up">+5.22% · 7D</div>
          </div>
          <svg className="sig" viewBox="0 0 300 60" preserveAspectRatio="none">
            <defs>
              <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--pos)" stopOpacity="0.22" />
                <stop offset="1" stopColor="var(--pos)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path className="fill" d={sparkPath(true)} fill="url(#sg)" />
            <path className="line" d={sparkPath(false)} fill="none" stroke="var(--pos)" strokeWidth="1.4" pathLength={1} vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="trow"><span>MARKET CAP</span><span>$1.25T</span></div>
          <div className="trow"><span>24H VOLUME</span><span>$28.4B</span></div>
          <div className="trow"><span>SUPPLY</span><span>19.7M / 21M</span></div>
          <div className="trow"><span>RANK</span><span>#01</span></div>
          <div className="conf">
            <div className="cl"><span>SIGNAL CONFIDENCE</span><b>78% · HIGH</b></div>
            <div className="bar"><i /></div>
          </div>
        </div>
        <div className="tele-verdict">
          <span className="stamp pos">POSITIVE</span>
          <span className="code">as of 22:19</span>
        </div>
        <div className="tele-foot">Information, not advice. Do your own research.</div>
      </aside>

      {/* Coordinate ruler */}
      <div className="cx-ruler">
        <span className="ruler-cell l">LENS/2026</span>
        <div className="ruler-ticks">{Array.from({ length: 44 }, (_, i) => <i key={i} />)}</div>
        <span className="ruler-cell r">FRAME 0{mode + 1}/05 · 62°N · FOCUSED</span>
      </div>
    </div>
  );
}
