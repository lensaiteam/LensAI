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
          <Terminal freeTierRemaining={freeTier?.remaining ?? 0} onUsed={refresh} onSignOut={signOut} />
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
  freeTierRemaining,
  onUsed,
  onSignOut,
}: {
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
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Session[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/history", { cache: "no-store" });
    if (res.ok) setHistory((await res.json()).sessions ?? []);
  }, []);
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamText, thinkKind]);

  const analyze = useCallback(
    async (raw: string) => {
      const t = raw.trim().toUpperCase();
      if (!t || streaming) return;
      setError(null);
      setAsOf(null);
      setMessages([{ role: "user", content: `Analyze ${t}` }]);
      setStreamText("");
      setThinkKind("analyze");
      setStreaming(true);
      setTicker(t);
      try {
        const r = await streamPost("/api/analyze", { ticker: t }, (txt) => setStreamText(txt));
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
      }
    },
    [streaming, onUsed, loadHistory],
  );

  const sendChat = useCallback(
    async (raw?: string) => {
      const msg = (raw ?? input).trim();
      if (!msg || !sessionId || streaming) return;
      setInput("");
      setError(null);
      setMessages((m) => [...m, { role: "user", content: msg }]);
      setStreamText("");
      setThinkKind("chat");
      setStreaming(true);
      try {
        const r = await streamPost("/api/chat", { sessionId, message: msg }, (txt) => setStreamText(txt));
        setMessages((m) => [...m, { role: "assistant", content: r.full }]);
      } catch (e) {
        setError((e as Error).message || "Chat failed.");
      } finally {
        setStreaming(false);
        setStreamText("");
        setThinkKind(null);
      }
    },
    [input, sessionId, streaming],
  );

  const openSession = useCallback(async (id: string) => {
    const res = await fetch(`/api/history/${id}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setSessionId(id);
    setTicker(data.ticker);
    setMessages(data.messages ?? []);
    setAsOf(null);
    setError(null);
  }, []);

  const newAnalysis = () => {
    setMessages([]);
    setSessionId(null);
    setTicker(null);
    setAsOf(null);
    setError(null);
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
        className="w-[220px] shrink-0 flex flex-col overflow-y-auto py-3"
        style={{ background: "var(--bg2)", borderRight: "1px solid var(--border)" }}
      >
        <button
          onClick={newAnalysis}
          className="mx-3 mb-3 py-2 text-[13px] font-semibold"
          style={{ background: "var(--w)", color: "var(--bg)" }}
        >
          + New analysis
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
              className="w-full text-left px-4 py-1.5 text-[12px] hover:bg-black/[0.04] flex items-center gap-2"
              style={{ color: sessionId === s.id ? "var(--gold)" : "var(--w2)" }}
            >
              <span className="font-semibold">{s.ticker}</span>
              <span className="text-[10px]" style={{ color: "var(--m)" }}>
                {new Date(s.created_at).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>

        <div className="px-3 pt-3 mt-2" style={{ borderTop: "1px solid var(--border)" }}>
          <button onClick={onSignOut} className="w-full text-left px-1 py-1.5 text-[12px]" style={{ color: "var(--w2)" }}>
            Sign out
          </button>
          <button onClick={deleteAccount} className="w-full text-left px-1 py-1.5 text-[12px]" style={{ color: "var(--red)" }}>
            Delete account
          </button>
        </div>
      </aside>

      {/* Main column: header · thread · composer */}
      {!hasThread ? (
        <main className="flex-1 overflow-y-auto">
          <EmptyState onAnalyze={analyze} error={error} />
        </main>
      ) : (
        <div className="chat-col">
          <header className="chat-head">
            <div className="chat-head-inner">
              <span className="tk">{ticker}</span>
              <div className="flex items-center gap-3">
                {asOf && (
                  <span className="asof">cached · as of {new Date(asOf).toLocaleTimeString()}</span>
                )}
                {verdict && <VerdictPill verdict={verdict} />}
              </div>
            </div>
          </header>

          <div className="thread" ref={scrollRef}>
            <div className="thread-inner">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="msg-user">{m.content}</div>
                ) : (
                  <AssistantMessage key={i} content={m.content} />
                ),
              )}
              {streaming && !streamText && thinkKind && <ThinkingTrace mode={thinkKind} />}
              {streaming && streamText && <AssistantMessage content={streamText} streaming />}
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

function AssistantMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  return (
    <div className="msg-ai">
      <div className="msg-ai-head">
        <span className="mini-mark" />
        <span className="msg-label">LensAI</span>
      </div>
      <div>
        <Markdown>{content}</Markdown>
        {streaming && <span className="stream-caret" />}
      </div>
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
