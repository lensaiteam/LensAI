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
type Msg = { role: "user" | "assistant"; content: string };
type Session = { id: string; ticker: string; created_at: string };

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
  }, [messages, streamText]);

  const analyze = useCallback(
    async (raw: string) => {
      const t = raw.trim().toUpperCase();
      if (!t || streaming) return;
      setError(null);
      setAsOf(null);
      setMessages([{ role: "user", content: `Analyze ${t}` }]);
      setStreamText("");
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
      }
    },
    [streaming, onUsed, loadHistory],
  );

  const sendChat = useCallback(async () => {
    const msg = input.trim();
    if (!msg || !sessionId || streaming) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setStreamText("");
    setStreaming(true);
    try {
      const r = await streamPost("/api/chat", { sessionId, message: msg }, (txt) => setStreamText(txt));
      setMessages((m) => [...m, { role: "assistant", content: r.full }]);
    } catch (e) {
      setError((e as Error).message || "Chat failed.");
    } finally {
      setStreaming(false);
      setStreamText("");
    }
  }, [input, sessionId, streaming]);

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

      {/* Main */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto">
        {!hasThread ? (
          <EmptyState onAnalyze={analyze} error={error} />
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold">{ticker}</h1>
              {asOf && (
                <span className="text-[11px]" style={{ color: "var(--m)" }}>
                  cached · as of {new Date(asOf).toLocaleTimeString()}
                </span>
              )}
            </div>

            {messages.map((m, i) => (
              <Bubble key={i} msg={m} />
            ))}
            {streaming && (
              <Bubble msg={{ role: "assistant", content: streamText || "…" }} />
            )}
            {error && <p className="text-xs mt-2" style={{ color: "var(--red)" }}>{error}</p>}
          </div>
        )}
      </main>

      {/* Chat bar (only within a thread) */}
      {hasThread && (
        <div />
      )}
      {hasThread && (
        <div
          className="shrink-0 px-6 py-3"
          style={{ background: "var(--bg2)", borderTop: "1px solid var(--border)" }}
        >
          <div className="max-w-3xl mx-auto flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="Ask a follow-up — sentiment, tokenomics, risks, news…"
              disabled={streaming || !sessionId}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
              style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--w)" }}
            />
            <button
              onClick={sendChat}
              disabled={streaming || !sessionId}
              className="px-5 text-sm font-semibold disabled:opacity-50"
              style={{ background: "var(--w)", color: "var(--bg)" }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`mb-5 ${isUser ? "flex justify-end" : ""}`}>
      <div
        className={isUser ? "px-4 py-2 rounded-2xl text-sm max-w-[80%]" : "w-full"}
        style={isUser ? { background: "var(--card2)", color: "var(--w)" } : undefined}
      >
        {isUser ? msg.content : <Markdown>{msg.content}</Markdown>}
      </div>
    </div>
  );
}

function EmptyState({ onAnalyze, error }: { onAnalyze: (t: string) => void; error: string | null }) {
  const [v, setV] = useState("");
  return (
    <div className="h-full flex flex-col items-center justify-center px-6 text-center">
      <span className="app-mark mb-6" />
      <h1 className="text-2xl font-bold mb-2 tracking-tight">Analyze a token</h1>
      <p className="text-sm mb-7 max-w-md" style={{ color: "var(--w2)" }}>
        Enter a ticker for a decision-grade, non-advisory read from live data and current news.
      </p>
      <div className="flex gap-2 w-full max-w-md">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAnalyze(v)}
          placeholder="e.g. BTC, ETH, SOL…"
          className="flex-1 px-4 py-3 rounded-lg text-sm outline-none uppercase"
          style={{ background: "var(--card)", border: "1px solid var(--border2)", color: "var(--w)" }}
        />
        <button
          onClick={() => onAnalyze(v)}
          className="px-6 text-sm font-semibold"
          style={{ background: "var(--w)", color: "var(--bg)" }}
        >
          Analyze
        </button>
      </div>
      <div className="flex gap-2 mt-4 flex-wrap justify-center">
        {QUICK.map((q) => (
          <button
            key={q}
            onClick={() => onAnalyze(q)}
            className="px-3 py-1.5 rounded-full text-xs"
            style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--w2)" }}
          >
            {q}
          </button>
        ))}
      </div>
      {error && <p className="text-xs mt-5" style={{ color: "var(--red)" }}>{error}</p>}
    </div>
  );
}
