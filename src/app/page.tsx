"use client";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";

const FEATURES = [
  {
    t: "Live data is the product",
    d: "Every analysis is built from current price, volume, supply and fresh news — not stale model memory.",
  },
  {
    t: "Non-advisory by design",
    d: "We assess whether signals look POSITIVE, MIXED, or NEGATIVE with both the bull and bear case. Never buy/sell calls.",
  },
  {
    t: "Wallet sign-in, nothing stored",
    d: "Connect MetaMask and sign a message to prove ownership. No email, no password, no private keys.",
  },
  {
    t: "Ask follow-ups",
    d: "After the analysis, ask about sentiment, tokenomics, risks or news in the same thread.",
  },
];

export default function Landing() {
  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <DisclaimerBanner />

      {/* Nav */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 h-[60px]"
        style={{ background: "rgba(8,8,8,0.6)", backdropFilter: "blur(24px)", borderBottom: "1px solid var(--border)" }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center text-black font-extrabold text-xs"
            style={{ background: "linear-gradient(135deg,var(--gold),#7a5a18)" }}
          >
            L
          </span>
          <span className="font-semibold tracking-tight">LensAI</span>
        </Link>
        <div className="flex items-center gap-3">
          <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
          <Link
            href="/app"
            className="text-[13px] font-medium text-black px-4 py-2 rounded-full"
            style={{ background: "var(--gold)" }}
          >
            Open App
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto text-center px-6 pt-24 pb-16">
        <div
          className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs mb-8"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--border)", color: "var(--w2)" }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--gold)" }} />
          Decision-grade crypto research
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.1] mb-5">
          Understand any token
          <br />
          <span style={{ color: "var(--gold)" }}>before you decide.</span>
        </h1>
        <p className="text-base leading-relaxed mb-9 max-w-xl mx-auto" style={{ color: "var(--w2)" }}>
          Enter a ticker. LensAI synthesizes live market data with current news and sentiment into a clear,
          non-advisory read on whether the signals look positive, mixed, or negative.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/app"
            className="px-6 py-3 rounded-full font-semibold text-black text-sm"
            style={{ background: "var(--gold)" }}
          >
            Analyze a token — 2 free
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 pb-24 grid sm:grid-cols-2 gap-4">
        {FEATURES.map((f) => (
          <div
            key={f.t}
            className="rounded-xl p-5"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <h3 className="font-semibold mb-1.5 text-[15px]">{f.t}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--w2)" }}>
              {f.d}
            </p>
          </div>
        ))}
      </section>

      <footer className="text-center pb-10 text-xs" style={{ color: "var(--m)" }}>
        LensAI · Information and analysis, not financial advice.
      </footer>
    </div>
  );
}
