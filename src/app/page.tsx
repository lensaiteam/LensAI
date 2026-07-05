"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
  useMotionValueEvent,
  useReducedMotion,
} from "framer-motion";
import { Reveal, Stagger, Item, MagneticButton, TiltCard, SmoothScroll } from "@/components/motion";
import "./landing.css";

const EASE = [0.16, 1, 0.3, 1] as const;

const HEADLINE: { t: string; em?: boolean; br?: boolean }[] = [
  { t: "Decision-grade" },
  { t: "intelligence,", em: true, br: true },
  { t: "never", br: true },
  { t: "advice." },
];

const TICKER = [
  ["BTC", "$62,578", "+5.2%", 1], ["ETH", "$1,770", "+12.8%", 1], ["SOL", "$80.98", "+13.6%", 1],
  ["ARB", "$0.078", "-2.5%", 0], ["JUP", "$0.24", "+14.1%", 1], ["PEPE", "$0.0000027", "-3.2%", 0],
  ["LINK", "$11.42", "+4.1%", 1], ["DOGE", "$0.061", "-1.8%", 0], ["AVAX", "$18.7", "+6.9%", 1],
] as const;

const STEPS = [
  { no: "01", h: "Enter a ticker", p: "Type any token — BTC, a mid-cap, or a long-tail address. We resolve it across Coinbase and CoinGecko." },
  { no: "02", h: "We gather the signal", p: "Live price, volume, supply, and current news are pulled and read in real time — the pipeline is the product, not the model's memory." },
  { no: "03", h: "You get a read", p: "A decision-grade, six-section analysis with an honest POSITIVE / MIXED / NEGATIVE call — the reasoning, both sides, no buy button." },
];

const SIGNALS = [
  { c: "pos", tag: "POSITIVE", p: "Strong fundamentals, healthy liquidity, constructive news flow — with the bear case still named." },
  { c: "mix", tag: "MIXED", p: "Real strengths against real risks. We show the tension instead of resolving it for you." },
  { c: "neg", tag: "NEGATIVE", p: "Thin liquidity, concentration, or red flags. If a token is unverifiable, we say so plainly." },
];

// Precomputed sparkline (representative).
function sparkPath(pts: number[], fill: boolean) {
  const W = 300, H = 58, max = Math.max(...pts), min = Math.min(...pts);
  const d = pts
    .map((v, i) => {
      const x = (i / (pts.length - 1)) * W;
      const y = H - 6 - ((v - min) / (max - min)) * (H - 14);
      return `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return fill ? `${d} L300 58 L0 58 Z` : d;
}
const SPARK = [42, 40, 44, 38, 36, 45, 41, 48, 44, 52, 49, 56, 53, 60, 58, 63];

export default function Landing() {
  return (
    <SmoothScroll>
      <LandingInner />
    </SmoothScroll>
  );
}

function LandingInner() {
  const reduce = useReducedMotion();
  const [stuck, setStuck] = useState(false);
  const { scrollY, scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 });

  useMotionValueEvent(scrollY, "change", (v) => setStuck(v > 40));

  // Parallax orbs (disabled under reduced motion).
  const yA = useTransform(scrollY, [0, 2400], [0, reduce ? 0 : 320]);
  const yB = useTransform(scrollY, [0, 2400], [0, reduce ? 0 : -260]);
  const yC = useTransform(scrollY, [0, 3000], [0, reduce ? 0 : 200]);

  const heroContainer = { hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } } };
  const wordVar = { hidden: { y: "110%" }, show: { y: 0, transition: { duration: 0.9, ease: EASE } } };
  const fade = (delay: number) => ({
    initial: { opacity: 0, y: 22 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.9, delay, ease: EASE },
  });

  return (
    <div className="lp">
      {/* Ambient background */}
      <div className="lp-bg">
        <div className="lp-grid" />
        <motion.div className="lp-orb a" style={{ y: yA }} />
        <motion.div className="lp-orb b" style={{ y: yB }} />
        <motion.div className="lp-orb c" style={{ y: yC }} />
        <div className="lp-scan" />
      </div>
      <motion.div className="lp-progress" style={{ scaleX: progress }} />

      {/* Nav */}
      <nav className={`lp-nav${stuck ? " stuck" : ""}`}>
        <Link className="brand" href="/">
          <span className="mark">L</span>LensAI
        </Link>
        <div className="lp-nav-links">
          <a href="#how">How it works</a>
          <a href="#signal">The read</a>
          <a href="#preview">Preview</a>
        </div>
        <div className="lp-nav-right">
          <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
          <Link href="/app" className="btn btn-solid btn-sm">
            <span>Open App</span>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <header className="lp-hero lp-wrap">
        <motion.div className="boot" {...fade(0.15)}>
          <span className="dot" /> system online · signal engine calibrated ·{" "}
          <span style={{ color: "var(--aqua)" }}>non-advisory</span>
        </motion.div>

        <motion.h1 className="h-serif hero-h1" variants={heroContainer} initial="hidden" animate="show">
          {HEADLINE.map((w, i) => (
            <span key={i}>
              <span className="word">
                <motion.span variants={wordVar} style={{ display: "inline-block", fontStyle: w.em ? "italic" : "normal", color: w.em ? "var(--gold-l)" : undefined }}>
                  {w.t}&nbsp;
                </motion.span>
              </span>
              {w.br && <br />}
            </span>
          ))}
        </motion.h1>

        <motion.p className="hero-sub" {...fade(1.0)}>
          A private research terminal for crypto. LensAI reads live markets and current news, then tells you
          whether the signals look <b style={{ color: "var(--pos)" }}>positive</b>,{" "}
          <b style={{ color: "var(--warn)" }}>mixed</b>, or <b style={{ color: "var(--neg)" }}>negative</b> — with the
          reasoning, both sides, and no one telling you to buy.
        </motion.p>

        <motion.div className="hero-cta" {...fade(1.2)}>
          <Link href="/app" style={{ textDecoration: "none" }}>
            <MagneticButton className="btn btn-solid">
              <span>Analyze a token</span>
              <span className="arw">→</span>
            </MagneticButton>
          </Link>
          <a href="#how" style={{ textDecoration: "none" }}>
            <MagneticButton className="btn btn-ghost">
              <span>See how it works</span>
            </MagneticButton>
          </a>
        </motion.div>

        <motion.div className="ticker" {...fade(1.45)}>
          <div className="ticker-row">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span className="tk" key={i}>
                <b>{t[0]}</b> {t[1]} <span className={t[3] ? "up" : "dn"}>{t[2]}</span>
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div className="scrollcue" {...fade(1.6)}>
          <span className="ln" /> Scroll
        </motion.div>
      </header>

      {/* How it works */}
      <section className="lp-section lp-wrap" id="how">
        <Reveal><span className="eyebrow">How it works</span></Reveal>
        <Reveal delay={0.05}><h2 className="h-serif h2">From ticker to a read in <em>one pass</em>.</h2></Reveal>
        <Reveal delay={0.1}>
          <p className="lead">The expensive part — gathering live data and news — happens once and is cached. Popular tokens are pre-computed and served instantly; only genuinely obscure ones hit a fresh pipeline.</p>
        </Reveal>
        <Stagger className="steps" gap={0.1}>
          {STEPS.map((s) => (
            <Item key={s.no} className="step">
              <div className="no">{s.no}</div>
              <h3>{s.h}</h3>
              <p>{s.p}</p>
            </Item>
          ))}
        </Stagger>
      </section>

      {/* The read / non-advisory */}
      <section className="lp-section lp-wrap" id="signal">
        <Reveal><span className="eyebrow aq">Non-advisory by design</span></Reveal>
        <Reveal delay={0.05}><h2 className="h-serif h2">We assess the signal — <em>you</em> make the call.</h2></Reveal>
        <Reveal delay={0.1}>
          <p className="lead">Telling you to buy or sell is unlicensed advice. So LensAI never does. It reads current signals as positive, mixed, or negative, and always presents both the bullish and bearish case.</p>
        </Reveal>
        <Stagger className="signals" gap={0.09}>
          {SIGNALS.map((s) => (
            <Item key={s.tag} variant="blur">
              <div className={`sigcard ${s.c}`}>
                <span className="tag">{s.tag}</span>
                <p>{s.p}</p>
                <div className="bar"><i /></div>
              </div>
            </Item>
          ))}
        </Stagger>
      </section>

      {/* Applied preview */}
      <section className="lp-section lp-wrap" id="preview">
        <Reveal><span className="eyebrow">A real read</span></Reveal>
        <Reveal delay={0.05}><h2 className="h-serif h2">Everything you need, <em>nothing you don't</em>.</h2></Reveal>
        <div className="applied">
          <Reveal variant="rise" delay={0.05}>
            <div>
              <div className="feat"><span className="fi">01</span><div><b>Snapshot & tokenomics.</b> Price, market cap, volume, supply model, unlock and concentration risk — in tabular mono.</div></div>
              <div className="feat"><span className="fi">02</span><div><b>Developments & sentiment.</b> Recent catalysts and the tone of coverage, each attributed to its source.</div></div>
              <div className="feat"><span className="fi">03</span><div><b>Risk flags.</b> Liquidity, volatility, and security signals surfaced as green / amber / red.</div></div>
              <div className="feat"><span className="fi">04</span><div><b>Overall read.</b> An honest synthesis with the reasoning — and follow-ups answered from the same gathered data.</div></div>
              <div style={{ marginTop: 26 }}>
                <Link href="/app" style={{ textDecoration: "none" }}>
                  <MagneticButton className="btn btn-solid"><span>Analyze BTC</span><span className="arw">→</span></MagneticButton>
                </Link>
              </div>
            </div>
          </Reveal>

          <Reveal variant="blur" delay={0.1}>
            <TiltCard className="acard">
              <div className="top">
                <div>
                  <div className="price">$62,578.74</div>
                  <div className="nm">Bitcoin · BTC</div>
                </div>
                <div className="sym">₿</div>
              </div>
              <svg className="spark" viewBox="0 0 300 58" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sg" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="var(--pos)" stopOpacity="0.35" />
                    <stop offset="1" stopColor="var(--pos)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={sparkPath(SPARK, true)} fill="url(#sg)" />
                <path d={sparkPath(SPARK, false)} fill="none" stroke="var(--pos)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="vchip">SIGNAL · POSITIVE</span>
                <span className="font-mono" style={{ fontSize: 12, color: "var(--mut)" }}>as of 22:19</span>
              </div>
              <div className="grid2">
                <div className="kv"><span>24H</span><span style={{ color: "var(--neg)" }}>−0.46%</span></div>
                <div className="kv"><span>7D</span><span style={{ color: "var(--pos)" }}>+5.22%</span></div>
                <div className="kv"><span>MKT CAP</span><span>$1.25T</span></div>
                <div className="kv"><span>RANK</span><span>#1</span></div>
              </div>
              <div className="flags">
                <span className="fl g">◆ Deepest liquidity</span>
                <span className="fl g">◆ Halving supply</span>
                <span className="fl y">◆ Macro-sensitive</span>
              </div>
              <div className="disc">LensAI provides information and analysis, not financial advice.</div>
            </TiltCard>
          </Reveal>
        </div>
      </section>

      {/* Privacy */}
      <section className="lp-section lp-wrap" id="privacy">
        <Reveal><span className="eyebrow aq">Your keys, your data</span></Reveal>
        <Reveal delay={0.05}><h2 className="h-serif h2">Sign in with a signature. <em>Nothing else.</em></h2></Reveal>
        <Stagger className="privacy" gap={0.09}>
          <Item className="p"><div className="k">No accounts</div><h4>Connect &amp; sign</h4><p>Prove you own your wallet with a message signature. No transaction, no gas, no private keys ever touch our servers.</p></Item>
          <Item className="p"><div className="k">No PII</div><h4>Address is the account</h4><p>No email, no password. Identity is just your wallet address — and you can delete everything in one click.</p></Item>
          <Item className="p"><div className="k">Two free</div><h4>Try before paying</h4><p>Your first two analyses are free. Popular tokens are served from cache and don't spend a credit.</p></Item>
        </Stagger>
      </section>

      {/* Final CTA */}
      <section className="lp-wrap cta-final">
        <Reveal variant="blur">
          <div className="big h-serif">Read the market like <em>a decision worth making.</em></div>
        </Reveal>
        <Reveal delay={0.1}>
          <Link href="/app" style={{ textDecoration: "none", display: "inline-block" }}>
            <MagneticButton className="btn btn-solid"><span>Open the terminal</span><span className="arw">→</span></MagneticButton>
          </Link>
        </Reveal>
        <div className="disclaimer-bar">LensAI provides information and analysis, not financial advice. Crypto is volatile; you can lose money.</div>
      </section>

      <footer className="lp-footer">
        <div className="lp-wrap row">
          <Link className="brand" href="/"><span className="mark">L</span>LensAI</Link>
          <div className="meta">© 2026 LensAI · gold #c8a84b on void #07070f</div>
        </div>
      </footer>
    </div>
  );
}
