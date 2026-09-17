"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useInView, useReducedMotion } from "framer-motion";

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Headline set line by line: each line rises out of its own mask. The MASK is what
 *  is observed for visibility — the line inside it starts clipped, so an observer on
 *  the line itself would never fire. */
export function LineReveal({ lines, as: Tag = "h1", className, delay = 0 }: { lines: ReactNode[]; as?: "h1" | "h2"; className?: string; delay?: number }) {
  return (
    <Tag className={className}>
      {lines.map((line, i) => (
        <motion.span className="ln" key={i} initial="hidden" whileInView="show" viewport={{ once: true, margin: "0px 0px -6% 0px" }}>
          <motion.span className="ln-in" variants={{ hidden: { y: "108%" }, show: { y: 0 } }} transition={{ duration: 1.05, ease: EASE, delay: delay + i * 0.09 }}>
            {line}
          </motion.span>
        </motion.span>
      ))}
    </Tag>
  );
}

/** A number that counts up to its value the first time it is seen. */
export function CountUp({ to, pad = 0, className, delay = 0 }: { to: number; pad?: number; className?: string; delay?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -8% 0px" });
  const reduce = useReducedMotion();
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!seen) return;
    if (reduce) { setV(to); return; }
    const controls = animate(0, to, { duration: 1.3, ease: EASE, delay, onUpdate: (x) => setV(Math.round(x)) });
    return () => controls.stop();
  }, [seen, to, reduce, delay]);
  return <span ref={ref} className={className}>{String(v).padStart(pad, "0")}</span>;
}

/** Registration marks at the corners of a sheet — the print-room motif. */
export function Marks() {
  return (
    <span className="marks" aria-hidden="true">
      <i /><i /><i /><i />
    </span>
  );
}

/** The numbered section frame every landing section shares. */
export function Sec({ n, label, id, children }: { n: string; label: string; id: string; children: ReactNode }) {
  return (
    <section className="lp-wrap sec" id={id}>
      <div className="sec-grid">
        <motion.div className="sec-num" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -10% 0px" }} transition={{ duration: 0.8, ease: EASE }}>
          {n} / {label}
          <span className="big">{n}</span>
        </motion.div>
        <div className="sec-body">{children}</div>
      </div>
    </section>
  );
}
