"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useAuth } from "@/components/AuthProvider";
import { DisclaimerBanner } from "@/components/DisclaimerBanner";
import { FirstLoginModal } from "@/components/FirstLoginModal";
import { Markdown } from "@/components/Markdown";
import { streamPost } from "@/lib/streamClient";
import "./app.css";

const QUICK = ["BTC", "ETH", "SOL", "XRP", "DOGE", "PEPE"];

// Follow-up prompts. Most map to fields the initial pipeline already
// gathered (spec §5.4), so they resolve cheaply — and they beat a
// blank box (recognition over recall).
const FOLLOWUPS: { label: string; prompt: string }[] = [
  { label: "Sentiment", prompt: "What's the current sentiment on it?" },
  { label: "Risk flags", prompt: "What are the main risk flags?" },
  { label: "Tokenomics", prompt: "Break down the tokenomics and supply." },
  { label: "Recent news", prompt: "What are the most recent developments?" },
  { label: "Bull vs bear", prompt: "Give me the bull case vs the bear case." },
];

// Ordered to mirror the real gather pipeline: market data → news →
// sentiment → risk → synthesis. Sequential concrete steps read as
// progress (goal-gradient), and showing the work builds trust
// (the Labor Illusion, Buell & Norton 2011).
const ANALYZE_STEPS = [
  "Pulling live price, volume & 24h range…",
  "Fetching market cap & circulating supply…",
  "Scanning headlines for catalysts…",
  "Checking CT sentiment…",
  "Reading the LARP tweets…",
  "Sniffing for rug & honeypot signals…",
  "Sizing up the tokenomics…",
  "Counting diamond hands vs paper hands…",
  "Weighing the bull case against the bears…",
  "Writing it up…",
];
const CHAT_STEPS = [
  "Digging through the notes…",
  "Re-reading the sentiment…",
  "Checking what the tape says…",
  "Connecting the dots…",
];

type Msg = { role: "user" | "assistant"; content: string };
type Session = { id: string; ticker: string; created_at: string };
type Verdict = "POSITIVE" | "MIXED" | "NEGATIVE";

/** Pull the model's overall read for the header payoff (peak-end rule). */
function extractVerdict(text: string): Verdict | null {
  const m = text.match(/\b(POSITIVE|MIXED|NEGATIVE)\b/);
  return (m?.[1] as Verdict) ?? null;
}

// Compact market snapshot shipped from /api/analyze via the x-lensai-market
// header (see route). Rendered as a scannable stat grid above the analysis.
type Snap = {
  name: string;
  symbol: string;
  price: string;
  c24: number | null;
  c7: number | null;
  vol: number | null;
  mcap: number | null;
  circ: number | null;
  rank: number | null;
  spark?: number[] | null;
  source?: string;
  unresolved: boolean;
};

function parseMarket(h: Headers): Snap | null {
  const raw = h.get("x-lensai-market");
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as Snap;
  } catch {
    return null;
  }
}

function fmtUSD(n: number | null): string {
  if (n == null) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}
function fmtNum(n: number | null): string {
  if (n == null) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}
function pct(n: number | null): { t: string; cls: string } {
  if (n == null) return { t: "—", cls: "" };
  return { t: `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`, cls: n >= 0 ? "up" : "down" };
}

/** Ease a number from 0 → target once, so figures tick up as they land. */
function useCountUp(target: number | null, dur = 800): number {
  const [val, setVal] = useState(target ?? 0);
  useEffect(() => {
    if (target == null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVal(target);
      return;
    }
    let raf = 0;
    let start = 0;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      setVal(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return val;
}

/** A stat figure that counts up to its value on mount. */
function CountStat({ value, format }: { value: number | null; format: (n: number | null) => string }) {
  const v = useCountUp(value);
  return <>{format(value == null ? null : v)}</>;
}

/** Single-series price sparkline (change-over-time). Colored by net move,
 *  always paired with the +/-% label so it's never color-alone. */
function Sparkline({ data, up, width = 108, height = 30 }: { data: number[]; up: boolean; width?: number; height?: number }) {
  if (!data || data.length < 3) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (width - 3) + 1.5;
    const y = height - 3 - ((v - min) / range) * (height - 6);
    return [x, y] as const;
  });
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${height} L${pts[0][0].toFixed(1)},${height} Z`;
  const color = up ? "#148a4f" : "#c62828";
  const gid = up ? "spark-up" : "spark-down";
  const last = pts[pts.length - 1];
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.2" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path className="spark-line" d={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" pathLength={1} />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill={color} />
    </svg>
  );
}

/** Diverging signal gauge: NEGATIVE (red) ↔ MIXED (amber) ↔ POSITIVE (green),
 *  with a needle that sweeps to the reading on mount. */
function SignalGauge({ signal }: { signal: Verdict }) {
  const cx = 66;
  const cy = 60;
  const r = 50;
  const polar = (deg: number, rad = r) => {
    const a = (deg * Math.PI) / 180;
    return [cx + rad * Math.cos(a), cy - rad * Math.sin(a)] as const;
  };
  const arc = (a1: number, a2: number) => {
    const [x1, y1] = polar(a1);
    const [x2, y2] = polar(a2);
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
  };
  const targetDeg = signal === "NEGATIVE" ? 152 : signal === "POSITIVE" ? 28 : 90;
  const [rot, setRot] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const to = 90 - targetDeg;
    if (reduce) {
      setRot(to);
      return;
    }
    const id = requestAnimationFrame(() => setRot(to));
    return () => cancelAnimationFrame(id);
  }, [targetDeg]);
  const [nx, ny] = polar(90, r - 6); // needle tip when pointing straight up
  const cls = signal === "POSITIVE" ? "v-positive" : signal === "NEGATIVE" ? "v-negative" : "v-mixed";
  return (
    <div className={`gauge ${cls}`}>
      <svg width="132" height="74" viewBox="0 0 132 74" aria-hidden>
        <path d={arc(180, 125)} stroke="#d8404c" strokeWidth="8" strokeLinecap="round" fill="none" opacity="0.9" />
        <path d={arc(119, 61)} stroke="#bd8420" strokeWidth="8" strokeLinecap="round" fill="none" opacity="0.9" />
        <path d={arc(55, 0)} stroke="#148a4f" strokeWidth="8" strokeLinecap="round" fill="none" opacity="0.9" />
        <g style={{ transform: `rotate(${rot}deg)`, transformOrigin: `${cx}px ${cy}px`, transition: "transform 1.05s cubic-bezier(.34,1.4,.5,1)" }}>
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="var(--txt)" strokeWidth="2.4" strokeLinecap="round" />
        </g>
        <circle cx={cx} cy={cy} r="5" fill="var(--txt)" />
        <circle cx={cx} cy={cy} r="2" fill="#fff" />
      </svg>
    </div>
  );
}

// Structured "Overall read" lifted out of the prose into a designed callout.
type VerdictData = { signal: Verdict; bull: string[]; bear: string[]; synthesis: string };

function stripInline(s: string): string {
  return s.replace(/\*\*/g, "").replace(/`/g, "").trim();
}
function bullets(section: string, label: string): string[] {
  const re = new RegExp(
    `\\*\\*\\s*${label}\\s*\\*\\*([\\s\\S]*?)(?=\\*\\*\\s*(?:Bull case|Bear case)\\s*\\*\\*|$)`,
    "i",
  );
  const block = section.match(re)?.[1] ?? "";
  return block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => stripInline(l.replace(/^[-*]\s+/, "")));
}

/** Split an analysis into body prose + the structured Overall read (if present). */
function parseOverallRead(md: string): { body: string; verdict: VerdictData | null; disclaimer: string } {
  const m = md.match(/^##\s+Overall read\s*$/im);
  if (!m || m.index === undefined) return { body: md, verdict: null, disclaimer: "" };

  const body = md.slice(0, m.index).trimEnd();
  const section = md.slice(m.index + m[0].length).trim();

  const signal =
    ((section.match(/Signal:\s*\**\s*(POSITIVE|MIXED|NEGATIVE)/i)?.[1]?.toUpperCase() as Verdict) ||
      extractVerdict(section) ||
      "MIXED") as Verdict;
  const bull = bullets(section, "Bull case");
  const bear = bullets(section, "Bear case");
  const disclaimer = stripInline(section.split("\n").find((l) => /financial advice/i.test(l)) ?? "");
  const synthesis = stripInline(
    section
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l &&
          !/Signal:\s*\**\s*(POSITIVE|MIXED|NEGATIVE)/i.test(l) &&
          !/^\*\*\s*(Bull case|Bear case)\s*\*\*/i.test(l) &&
          !/^[-*]\s+/.test(l) &&
          !/financial advice/i.test(l),
      )
      .join(" "),
  );

  return { body, verdict: { signal, bull, bear, synthesis }, disclaimer };
}

function VerdictCallout({ verdict, disclaimer }: { verdict: VerdictData; disclaimer: string }) {
  const cls =
    verdict.signal === "POSITIVE" ? "v-positive" : verdict.signal === "NEGATIVE" ? "v-negative" : "v-mixed";
  const hasCases = verdict.bull.length > 0 || verdict.bear.length > 0;
  return (
    <div className={`verdict-callout ${cls}`}>
      <div className="vc-head">
        <SignalGauge signal={verdict.signal} />
        <div className="vc-head-txt">
          <span className="vc-badge">{verdict.signal}</span>
          <span className="vc-title">Overall read</span>
        </div>
        <span className="vc-note">Current signals · not advice</span>
      </div>
      {verdict.synthesis && <p className="vc-synth">{verdict.synthesis}</p>}
      {hasCases && (
        <div className="vc-cases">
          <div className="vc-col vc-bull">
            <span className="vc-col-h">Bull case</span>
            <ul>
              {verdict.bull.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
          <div className="vc-col vc-bear">
            <span className="vc-col-h">Bear case</span>
            <ul>
              {verdict.bear.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {disclaimer && <p className="vc-disc">{disclaimer}</p>}
    </div>
  );
}

function shortAddr(a: string): string {
  return a.length > 10 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
/** Deterministic 2-stop gradient from a wallet address (mini identicon). */
function addrGradient(a: string): string {
  let h = 0;
  for (let i = 0; i < a.length; i++) h = (h * 31 + a.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 60) % 360} 70% 50%))`;
}

function AssetHeader({
  ticker,
  snap,
  asOf,
  verdict,
}: {
  ticker: string;
  snap: Snap | null;
  asOf: string | null;
  verdict: Verdict | null;
}) {
  const c24 = pct(snap?.c24 ?? null);
  return (
    <div className="chat-head-inner">
      <div className="ah-left">
        <div className="ah-id">
          <span className="ah-tk">{ticker}</span>
          {snap?.name && snap.name.toUpperCase() !== ticker && <span className="ah-name">{snap.name}</span>}
        </div>
        {snap?.price && (
          <div className="ah-price">
            <span className="ah-px">{snap.price}</span>
            {snap.c24 != null && <span className={`ah-delta ${c24.cls}`}>{c24.t}</span>}
          </div>
        )}
        {snap?.spark && snap.spark.length > 2 && (
          <Sparkline data={snap.spark} up={(snap.c7 ?? snap.c24 ?? 0) >= 0} />
        )}
      </div>
      <div className="ah-right">
        {asOf && <span className="asof">cached · {new Date(asOf).toLocaleTimeString()}</span>}
        {verdict && <VerdictPill verdict={verdict} />}
      </div>
    </div>
  );
}

function AccountMenu({
  walletAddress,
  freeRemaining,
  onSignOut,
  onDelete,
}: {
  walletAddress: string;
  freeRemaining: number;
  onSignOut: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="side-acct" ref={ref}>
      {open && (
        <div className="acct-menu">
          <div className="acct-menu-head">
            <div className="acct-menu-addr">{shortAddr(walletAddress)}</div>
            <div className="acct-menu-sub">Connected · {freeRemaining} free left</div>
          </div>
          <button
            className="acct-item"
            onClick={() => {
              navigator.clipboard?.writeText(walletAddress);
              setOpen(false);
            }}
          >
            <svg viewBox="0 0 16 16" fill="none"><rect x="5.5" y="5.5" width="7.5" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><path d="M3 10.5V4a1 1 0 011-1h6.5" stroke="currentColor" strokeWidth="1.3" /></svg>
            Copy address
          </button>
          <button className="acct-item" onClick={onSignOut}>
            <svg viewBox="0 0 16 16" fill="none"><path d="M10 11.5L13 8l-3-3.5M13 8H5.5M6.5 3H3v10h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Sign out
          </button>
          <button className="acct-item danger" onClick={onDelete}>
            <svg viewBox="0 0 16 16" fill="none"><path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.5 8.5h5l.5-8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Delete account
          </button>
        </div>
      )}
      <button className={`acct-chip ${open ? "open" : ""}`} onClick={() => setOpen((o) => !o)}>
        <span className="acct-dot" style={{ background: addrGradient(walletAddress) }} />
        <span className="acct-addr">{shortAddr(walletAddress)}</span>
        <svg className="acct-caret" viewBox="0 0 16 16" fill="none" width="13" height="13"><path d="M4.5 6.5L8 10l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}

function SnapshotGrid({ snap }: { snap: Snap }) {
  const c24 = pct(snap.c24);
  const c7 = pct(snap.c7);
  return (
    <div className="snap">
      <div className="snap-cell">
        <span className="snap-k">Price</span>
        <span className="snap-v">{snap.price || "—"}</span>
        {snap.c24 != null && <span className={`snap-d ${c24.cls}`}>{c24.t} 24h</span>}
      </div>
      <div className="snap-cell">
        <span className="snap-k">24h</span>
        <span className={`snap-v ${c24.cls}`}>
          <CountStat value={snap.c24} format={(n) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`)} />
        </span>
      </div>
      <div className="snap-cell">
        <span className="snap-k">7d</span>
        <span className={`snap-v ${c7.cls}`}>
          <CountStat value={snap.c7} format={(n) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`)} />
        </span>
      </div>
      <div className="snap-cell">
        <span className="snap-k">Market cap</span>
        <span className="snap-v"><CountStat value={snap.mcap} format={fmtUSD} /></span>
        {snap.rank != null && <span className="snap-d muted">#{snap.rank}</span>}
      </div>
      <div className="snap-cell">
        <span className="snap-k">24h volume</span>
        <span className="snap-v"><CountStat value={snap.vol} format={fmtUSD} /></span>
      </div>
      <div className="snap-cell">
        <span className="snap-k">Circ. supply</span>
        <span className="snap-v"><CountStat value={snap.circ} format={fmtNum} /></span>
        <span className="snap-d muted">{snap.symbol}</span>
      </div>
    </div>
  );
}

export default function ResearchTerminal() {
  const { user, freeTier, loading, signingIn, signIn, signOut, error: authError, refresh } = useAuth();

  return (
    <div className="app-shell flex flex-col h-screen" style={{ background: "var(--bg)" }}>
      <DisclaimerBanner />
      <Topbar />
      {loading ? (
        <Center>Loading…</Center>
      ) : !user ? (
        <SignInGate signingIn={signingIn} signIn={signIn} error={authError} />
      ) : (
        <>
          <FirstLoginModal walletAddress={user.walletAddress} />
          <Terminal
            walletAddress={user.walletAddress}
            freeTierRemaining={freeTier?.remaining ?? 0}
            onUsed={refresh}
            onSignOut={signOut}
          />
        </>
      )}
    </div>
  );
}

function Topbar() {
  return (
    <div
      className="h-[52px] flex items-center justify-between px-4 shrink-0"
      style={{ background: "var(--bg2)", borderBottom: "1px solid var(--border)" }}
    >
      <Link href="/" className="flex items-center gap-2.5">
        <span className="app-glyph" />
        <span className="font-bold text-[14px] tracking-tight">LensAI</span>
      </Link>
      <ConnectButton showBalance={false} chainStatus="none" accountStatus="address" />
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center text-sm" style={{ color: "var(--w2)" }}>
      {children}
    </div>
  );
}

function SignInGate({
  signingIn,
  signIn,
  error,
}: {
  signingIn: boolean;
  signIn: () => void;
  error: string | null;
}) {
  const { isConnected } = useAccount();
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div
        className="max-w-sm w-full text-center rounded-2xl p-8"
        style={{ background: "var(--panel)", border: "1px solid var(--border)" }}
      >
        <div className="flex justify-center mb-4"><span className="app-mark" /></div>
        <h1 className="text-lg font-bold mb-1.5 tracking-tight">Sign in with your wallet</h1>
        <p className="text-sm mb-6" style={{ color: "var(--w2)" }}>
          Connect MetaMask and sign a message to prove ownership. No transaction, no gas, no private keys.
        </p>
        <div className="flex flex-col items-center gap-3">
          <ConnectButton showBalance={false} chainStatus="none" accountStatus="full" />
          {isConnected && (
            <button
              onClick={signIn}
              disabled={signingIn}
              className="w-full py-3 font-semibold disabled:opacity-60"
              style={{ background: "var(--w)", color: "var(--bg)" }}
            >
              {signingIn ? "Check your wallet…" : "Sign in"}
            </button>
          )}
          {error && <p className="text-xs" style={{ color: "var(--red)" }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

function Terminal({
  walletAddress,
  freeTierRemaining,
  onUsed,
  onSignOut,
}: {
  walletAddress: string;
  freeTierRemaining: number;
  onUsed: () => void;
  onSignOut: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [thinkKind, setThinkKind] = useState<"analyze" | "chat" | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ticker, setTicker] = useState<string | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Session[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Typewriter — reveal streamed text at a readable pace even when the network
  // delivers it in big bursts, so the model reads as if it's typing rather than
  // pasting. `shown` is how many chars of `streamText` are currently visible;
  // an ease-out loop keeps it just behind the incoming text and finishes fast.
  const [shown, setShown] = useState(0);
  const shownRef = useRef(0);
  const targetRef = useRef("");
  const rafRef = useRef<number | null>(null);
  const reduceRef = useRef(false);
  useEffect(() => {
    reduceRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const startTyping = useCallback(() => {
    if (rafRef.current != null) return;
    const loop = () => {
      const target = targetRef.current.length;
      if (shownRef.current < target) {
        const gap = target - shownRef.current;
        // ~9% of the remaining gap per frame (min 2 chars) → smooth, ~1s tail.
        const step = reduceRef.current ? gap : Math.max(2, Math.floor(gap * 0.09));
        shownRef.current = Math.min(target, shownRef.current + step);
        setShown(shownRef.current);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, []);
  const stopTyping = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);
  const resetTyping = useCallback(() => {
    stopTyping();
    shownRef.current = 0;
    targetRef.current = "";
    setShown(0);
  }, [stopTyping]);
  const awaitTypingDone = useCallback(
    () =>
      new Promise<void>((resolve) => {
        const check = () => {
          if (shownRef.current >= targetRef.current.length) resolve();
          else requestAnimationFrame(check);
        };
        check();
      }),
    [],
  );
  useEffect(() => () => stopTyping(), [stopTyping]);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/history", { cache: "no-store" });
    if (res.ok) setHistory((await res.json()).sessions ?? []);
  }, []);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, shown, thinkKind]);

  const analyze = useCallback(
    async (raw: string) => {
      const t = raw.trim().toUpperCase();
      if (!t || streaming) return;
      setError(null);
      setAsOf(null);
      setSnap(null);
      setMessages([{ role: "user", content: `Analyze ${t}` }]);
      setStreamText("");
      resetTyping();
      setThinkKind("analyze");
      setStreaming(true);
      setTicker(t);
      startTyping();
      try {
        const r = await streamPost(
          "/api/analyze",
          { ticker: t },
          (txt) => {
            targetRef.current = txt;
            setStreamText(txt);
          },
          (h) => setSnap(parseMarket(h)),
        );
        targetRef.current = r.full;
        setStreamText(r.full);
        await awaitTypingDone(); // let the typewriter finish before committing
        setSessionId(r.headers.get("x-lensai-session"));
        if (r.headers.get("x-lensai-cache-hit") === "1") setAsOf(r.headers.get("x-lensai-as-of"));
        setMessages((m) => [...m, { role: "assistant", content: r.full }]);
        onUsed();
        loadHistory();
      } catch (e) {
        const err = e as { status?: number; message?: string; data?: { code?: string } };
        setError(
          err.data?.code === "FREE_TIER_EXHAUSTED"
            ? "You've used your 2 free analyses. A paid tier is coming soon."
            : err.message || "Something went wrong.",
        );
        setMessages([]);
        setTicker(null);
      } finally {
        setStreaming(false);
        setStreamText("");
        setThinkKind(null);
        resetTyping();
      }
    },
    [streaming, onUsed, loadHistory, startTyping, resetTyping, awaitTypingDone],
  );

  const sendChat = useCallback(
    async (raw?: string) => {
      const msg = (raw ?? input).trim();
      if (!msg || !sessionId || streaming) return;
      setInput("");
      setError(null);
      setMessages((m) => [...m, { role: "user", content: msg }]);
      setStreamText("");
      resetTyping();
      setThinkKind("chat");
      setStreaming(true);
      startTyping();
      try {
        const r = await streamPost("/api/chat", { sessionId, message: msg }, (txt) => {
          targetRef.current = txt;
          setStreamText(txt);
        });
        targetRef.current = r.full;
        setStreamText(r.full);
        await awaitTypingDone();
        setMessages((m) => [...m, { role: "assistant", content: r.full }]);
      } catch (e) {
        setError((e as Error).message || "Chat failed.");
      } finally {
        setStreaming(false);
        setStreamText("");
        setThinkKind(null);
        resetTyping();
      }
    },
    [input, sessionId, streaming, startTyping, resetTyping, awaitTypingDone],
  );

  const openSession = useCallback(async (id: string) => {
    const res = await fetch(`/api/history/${id}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setSessionId(id);
    setTicker(data.ticker);
    setMessages(data.messages ?? []);
    setAsOf(null);
    setSnap(null);
    setError(null);
    resetTyping();
  }, [resetTyping]);

  const newAnalysis = () => {
    setMessages([]);
    setSessionId(null);
    setTicker(null);
    setAsOf(null);
    setSnap(null);
    setError(null);
    resetTyping();
  };

  const deleteAccount = async () => {
    if (!confirm("Delete your account and all research history? This cannot be undone.")) return;
    await fetch("/api/account", { method: "DELETE" });
    onSignOut();
  };

  const hasThread = messages.length > 0 || streaming;
  const firstAnalysis = messages.find((m) => m.role === "assistant")?.content;
  const verdict = firstAnalysis ? extractVerdict(firstAnalysis) : null;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className="app-side w-[220px] shrink-0 flex flex-col overflow-y-auto py-3"
        style={{ background: "var(--bg2)", borderRight: "1px solid var(--border)" }}
      >
        <button
          onClick={newAnalysis}
          className="side-new mx-3 mb-3 py-2 text-[13px] font-semibold"
          style={{ background: "var(--w)", color: "var(--bg)" }}
        >
          <span>+ New analysis</span>
        </button>
        <div className="px-4 text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--dim)" }}>
          Free analyses
        </div>
        <div className="px-4 flex gap-1.5 mb-4">
          {[0, 1].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full"
              style={{ background: i < freeTierRemaining ? "var(--gold)" : "var(--dim)" }}
            />
          ))}
          <span className="text-[10px] ml-1" style={{ color: "var(--m)" }}>
            {freeTierRemaining} left
          </span>
        </div>

        <div className="px-4 text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--dim)" }}>
          History
        </div>
        <div className="flex-1">
          {history.length === 0 && <div className="px-4 text-[11px]" style={{ color: "var(--m)" }}>No sessions yet.</div>}
          {history.map((s) => (
            <button
              key={s.id}
              onClick={() => openSession(s.id)}
              className={`side-hist w-full text-left px-4 py-2 text-[12px] flex items-center gap-2 ${sessionId === s.id ? "active" : ""}`}
              style={{ color: sessionId === s.id ? "var(--gold)" : "var(--w2)" }}
            >
              <span className="font-semibold flex-1">{s.ticker}</span>
              <span className="text-[10px]" style={{ color: "var(--m)" }}>
                {new Date(s.created_at).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>

        <AccountMenu
          walletAddress={walletAddress}
          freeRemaining={freeTierRemaining}
          onSignOut={onSignOut}
          onDelete={deleteAccount}
        />
      </aside>

      {/* Main column: header · thread · composer */}
      {!hasThread ? (
        <main className="flex-1 overflow-y-auto">
          <EmptyState onAnalyze={analyze} error={error} />
        </main>
      ) : (
        <div className="chat-col">
          <header className="chat-head">
            <AssetHeader ticker={ticker ?? ""} snap={snap} asOf={asOf} verdict={verdict} />
          </header>

          <div className="thread" ref={scrollRef}>
            <div className="thread-inner">
              {snap && !snap.unresolved && <SnapshotGrid snap={snap} />}
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="msg-user">{m.content}</div>
                ) : (
                  <AssistantMessage key={i} content={m.content} />
                ),
              )}
              {streaming && shown === 0 && thinkKind && <ThinkingTrace mode={thinkKind} />}
              {streaming && shown > 0 && (
                <AssistantMessage content={streamText.slice(0, shown)} streaming />
              )}
              {error && <p className="text-xs" style={{ color: "var(--red)" }}>{error}</p>}
            </div>
          </div>

          <Composer
            input={input}
            setInput={setInput}
            onSend={sendChat}
            disabled={streaming || !sessionId}
            showChips={messages.length <= 2 && !streaming}
          />
        </div>
      )}
    </div>
  );
}

function VerdictPill({ verdict }: { verdict: Verdict }) {
  const cls = verdict === "POSITIVE" ? "v-pos" : verdict === "NEGATIVE" ? "v-neg" : "v-mix";
  return <span className={`verdict-pill ${cls}`}>{verdict}</span>;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      className="msg-copy"
      onClick={() => {
        navigator.clipboard?.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
      aria-label="Copy"
    >
      {done ? (
        <svg viewBox="0 0 16 16" fill="none"><path d="M3 8.5l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="square" /></svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none"><rect x="5.5" y="5.5" width="7.5" height="7.5" stroke="currentColor" strokeWidth="1.3" /><path d="M3 10.5V3h7.5" stroke="currentColor" strokeWidth="1.3" /></svg>
      )}
      <span>{done ? "Copied" : "Copy"}</span>
    </button>
  );
}

function AssistantMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  // While streaming, render raw so a half-formed Overall read doesn't flicker a
  // partial callout. Once final, lift it into the designed verdict panel.
  const parsed = streaming ? null : parseOverallRead(content);
  const body = parsed ? parsed.body : content;
  return (
    <div className="msg-ai">
      <div className="msg-ai-head">
        <span className="mini-mark" />
        <span className="msg-label">LensAI</span>
        {!streaming && <CopyButton text={content} />}
      </div>
      <div>
        <Markdown>{body}</Markdown>
        {streaming && <span className="stream-caret" />}
      </div>
      {parsed?.verdict && <VerdictCallout verdict={parsed.verdict} disclaimer={parsed.disclaimer} />}
    </div>
  );
}

function ThinkingTrace({ mode }: { mode: "analyze" | "chat" }) {
  const steps = mode === "analyze" ? ANALYZE_STEPS : CHAT_STEPS;
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    const period = mode === "analyze" ? 1500 : 1050;
    const id = setInterval(() => setI((p) => (p < steps.length - 1 ? p + 1 : p)), period);
    return () => clearInterval(id);
  }, [mode, steps.length]);

  return (
    <div className="think">
      <div className="think-row">
        <span className="think-orb" />
        <span key={i} className="think-line">{steps[i]}</span>
        <span className="think-dots"><i /><i /><i /></span>
      </div>
      <div className="think-skel">
        <span className="skel-line" />
        <span className="skel-line" style={{ width: "94%" }} />
        <span className="skel-line" style={{ width: "82%" }} />
        <span className="skel-line" style={{ width: "88%" }} />
      </div>
    </div>
  );
}

function Composer({
  input,
  setInput,
  onSend,
  disabled,
  showChips,
}: {
  input: string;
  setInput: (v: string) => void;
  onSend: (raw?: string) => void;
  disabled: boolean;
  showChips: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea with its content, up to the CSS max-height.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    ta.style.height = Math.min(ta.scrollHeight, 168) + "px";
  }, [input]);

  return (
    <div className="composer-wrap">
      <div className="composer-inner">
        {showChips && (
          <div className="chips">
            {FOLLOWUPS.map((f) => (
              <button key={f.label} className="chip" disabled={disabled} onClick={() => onSend(f.prompt)}>
                {f.label}
              </button>
            ))}
          </div>
        )}
        <div className="composer">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            placeholder="Ask a follow-up — “is it a rug?”, unlocks, sentiment, news…"
            disabled={disabled}
          />
          <button className="send-btn" onClick={() => onSend()} disabled={disabled || !input.trim()} aria-label="Send">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M8 13V3.5M8 3.5L3.5 8M8 3.5L12.5 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="square" />
            </svg>
          </button>
        </div>
        <div className="composer-hint">
          <span><kbd>↵</kbd>send</span>
          <span><kbd>⇧↵</kbd>new line</span>
          <span>Not financial advice.</span>
        </div>
      </div>
    </div>
  );
}

// Playful openers, re-rolled on every fresh start. [before, accent, after] —
// the accent word gets the red. Teasing but never advisory.
const HEADS: [string, string, string][] = [
  ["What's going ", "under the lens", "?"],
  ["Point the lens at ", "something", "."],
  ["Fresh eyes. ", "New token", "."],
  ["Who are we ", "investigating", " today?"],
  ["Name a ", "ticker", ". Any ticker."],
  ["New coin on the ", "slab", "."],
  ["Let's dig into ", "something new", "."],
  ["Line up the next ", "suspect", "."],
];

function EmptyState({ onAnalyze, error }: { onAnalyze: (t: string) => void; error: string | null }) {
  const [v, setV] = useState("");
  const [head, setHead] = useState<[string, string, string]>(HEADS[0]);

  // Roll a random opener on mount (client-only — no hydration mismatch since
  // the terminal is gated behind auth).
  useEffect(() => {
    setHead(HEADS[Math.floor(Math.random() * HEADS.length)]);
  }, []);

  return (
    <div className="hero">
      <span className="app-mark hero-mark" />
      <h1 className="hero-title">
        {head[0]}
        <span className="amp">{head[1]}</span>
        {head[2]}
      </h1>
      <p className="hero-sub">
        Type a ticker and LensAI reads the live market, the news, and the crowd — a decision-grade,
        non-advisory take in seconds.
      </p>

      <div className="hero-input">
        <span className="hero-dollar">$</span>
        <input
          className="hero-field"
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAnalyze(v)}
          placeholder="BTC"
          autoFocus
          aria-label="Token ticker"
        />
        <button className="hero-go" onClick={() => onAnalyze(v)} aria-label="Analyze">
          <svg viewBox="0 0 20 20" fill="none">
            <path d="M4 10h11M10 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
          </svg>
        </button>
      </div>

      <div className="hero-chips">
        {QUICK.map((q) => (
          <button key={q} className="hero-chip" onClick={() => onAnalyze(q)}>
            {q}
          </button>
        ))}
      </div>
      {error && <p className="text-xs mt-5" style={{ color: "var(--red)" }}>{error}</p>}
    </div>
  );
}
