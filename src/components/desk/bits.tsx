"use client";
import type { ReactNode } from "react";
import { STAGES, type Stage } from "@/lib/agentClient";

/** UTC, to the minute, the way the engine stamps anchors. */
export function utc(ms: number | null | undefined): string {
  if (ms == null) return "n/a";
  return new Date(ms).toISOString().replace("T", " ").slice(0, 16) + "Z";
}

export function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export const pct = (v: number): string => `P${Math.round(v * 100).toString().padStart(2, "0")}`;

export function Tag({ kind, children }: { kind: "measured" | "mechanical" | "conjecture" | "red" | "mut" | "ink"; children: ReactNode }) {
  return <span className={`dk-tag ${kind}`}>{children}</span>;
}

/** The mono placard row that heads every sheet: label · value pairs. */
export function Placard({ items }: { items: (readonly [string, ReactNode] | null)[] }) {
  return (
    <div className="dk-ph">
      {items.filter((x): x is readonly [string, ReactNode] => !!x).map(([k, v]) => (
        <span key={k}>
          {k} <b>{v}</b>
        </span>
      ))}
    </div>
  );
}

export function Sheet({ children, marks, className = "" }: { children: ReactNode; marks?: boolean; className?: string }) {
  return (
    <section className={`dk-sheet ${className}`}>
      {marks && <span className="marks" aria-hidden="true"><i /><i /><i /><i /></span>}
      {children}
    </section>
  );
}

export function Stagebar({ at }: { at: Stage | null }) {
  const idx = at ? STAGES.indexOf(at) : -1;
  return (
    <div className="dk-stages" role="status" aria-live="polite" aria-label="Answer progress">
      {STAGES.map((s, i) => (
        <span key={s} className={`dk-stage${i < idx ? " done" : i === idx ? " on" : ""}`}>{s}</span>
      ))}
    </div>
  );
}

export function Btn({ children, ghost, small, ...rest }: { children: ReactNode; ghost?: boolean; small?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`dk-btn${ghost ? " ghost" : ""}${small ? " sm" : ""}`} {...rest}>
      {children}
    </button>
  );
}

export function Err({ children }: { children: ReactNode }) {
  return children ? <p className="dk-err" role="alert">{children}</p> : null;
}

export function Empty({ title, dim, children }: { title: string; dim: string; children?: ReactNode }) {
  return (
    <div className="dk-empty">
      <h2 className="display">
        {title} <em>{dim}</em>
      </h2>
      {children}
    </div>
  );
}
