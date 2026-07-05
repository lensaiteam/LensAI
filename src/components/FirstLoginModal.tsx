"use client";
import { useEffect, useState } from "react";

/** One-time acknowledgement modal on first login (CLAUDE.md §7). */
export function FirstLoginModal({ walletAddress }: { walletAddress: string }) {
  const key = `lensai_ack_${walletAddress.toLowerCase()}`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(key) !== "1") setOpen(true);
  }, [key]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div
        className="max-w-md w-full rounded-2xl p-7"
        style={{ background: "var(--panel)", border: "1px solid var(--border2)" }}
      >
        <div className="text-[var(--gold)] text-2xl mb-3">⚠️</div>
        <h2 className="text-lg font-bold mb-2">Before you start</h2>
        <p className="text-sm leading-relaxed mb-3" style={{ color: "var(--w2)" }}>
          LensAI provides <strong className="text-[var(--w)]">information and analysis, not financial advice</strong>.
          It never tells you to buy or sell — it assesses whether current signals look positive, mixed, or negative.
        </p>
        <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--w2)" }}>
          Crypto is highly volatile and you can lose money. Always do your own research.
        </p>
        <button
          onClick={() => {
            localStorage.setItem(key, "1");
            setOpen(false);
          }}
          className="w-full py-3 rounded-lg font-semibold text-black"
          style={{ background: "var(--gold)" }}
        >
          I understand
        </button>
      </div>
    </div>
  );
}
