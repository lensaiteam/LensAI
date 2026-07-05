"use client";
import { useEffect, useState } from "react";

const TEXT =
  "LensAI provides information and analysis, not financial advice. Do your own research. Crypto is highly volatile and you can lose money.";

/** Persistent, dismissible disclaimer banner (CLAUDE.md §7). */
export function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    setDismissed(localStorage.getItem("lensai_banner_dismissed") === "1");
  }, []);
  if (dismissed) return null;
  return (
    <div
      className="w-full text-[11px] px-4 py-2 flex items-center justify-center gap-3 text-center"
      style={{ background: "rgba(200,168,75,0.08)", borderBottom: "1px solid var(--border)", color: "var(--w2)" }}
    >
      <span>⚠️ {TEXT}</span>
      <button
        onClick={() => {
          localStorage.setItem("lensai_banner_dismissed", "1");
          setDismissed(true);
        }}
        className="text-[var(--m)] hover:text-[var(--w)] shrink-0"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
