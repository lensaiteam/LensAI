"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { EASE, LineReveal, Marks } from "@/components/landing/kit";

const rise = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "0px 0px -10% 0px" } } as const;

const VALUES = [
  ["W.1", "The join is the product", "Anyone can chart a factor. We are obsessed with the part that compounds: the normalized history, the immutable corpus, the curated graph, the calibration record."],
  ["W.2", "Honest by default", "We surface uncertainty instead of hiding it. A labeled conjecture beats a confident guess, in the product and in the way we work."],
  ["W.3", "Small team, real ownership", "You own outcomes end to end. Fewer people, more surface area, more trust."],
  ["W.4", "Ship, then sharpen", "We put things in front of users early and let reality tell us what to refine next."],
] as const;

const ROLES = [
  { code: "R01", title: "Data Pipeline Engineer", team: "Engineering", type: "Remote · Full-time", blurb: "Own capture and the factor store: append-only ingest, point-in-time reads, percentile normalization, and the cost architecture that keeps a read near-free at scale. Correctness and no-lookahead are your KPIs.", looks: ["Has shipped data systems where a wrong number is worse than no number", "Comfortable in TypeScript and SQL; opinions about immutability", "Writes the test that proves the invariant before the feature"] },
  { code: "R02", title: "Frontend Engineer", team: "Product", type: "Remote · Full-time", blurb: "Build the desk: the agents' interface, streaming reads, and motion that only ever demonstrates something true. A research UI that feels like an instrument, not a dashboard.", looks: ["Strong eye for type, rhythm and interaction detail", "React and the platform: transforms, observers, accessibility", "Cares that it runs at 60fps on an integrated GPU"] },
  { code: "R03", title: "Applied ML / Prompt Engineer", team: "Research", type: "Remote · Contract", blurb: "Tune narration under the fail-closed gates: structured claims, attribution, the admission evals that decide which models earn a place in the pool. You measure quality, not vibes.", looks: ["Builds evals before prompts", "Skeptical of model output by temperament", "Can explain a failure mode in one paragraph"] },
  { code: "R04", title: "Product Designer", team: "Design", type: "Remote · Full-time", blurb: "Define the visual and interaction language across the site and the desk. Editorial, restrained and alive. You set the bar, and you hold it.", looks: ["A portfolio with a point of view, not a template", "Information design: tables, states, density", "Writes: copy is design material here"] },
] as const;

const HOW = [
  ["Remote-first", "Work from wherever you do your best thinking. We overlap for a few core hours and otherwise optimize for deep work."],
  ["Async & written", "Decisions live in writing so anyone can catch up. Fewer meetings, clearer thinking."],
  ["Real ownership", "You pick up problems, not tickets, and see them through to users."],
  ["Fair equity", "Everyone shares in the upside. Compensation is transparent within the team."],
] as const;

const PROCESS = [
  ["Intro", "A short call to trade context: what you've built, what we're building."],
  ["Deep dive", "A working session on a real problem in your area. No trick questions, no take-home marathons."],
  ["Meet the team", "Conversations with the people you'd work with day to day."],
  ["Offer", "A clear, written offer with transparent compensation and equity."],
] as const;

function Head({ n, title }: { n: string; title: string }) {
  return (
    <div className="blk-head">
      <span className="mono">{n}</span>
      <LineReveal as="h2" className="display" lines={[title]} />
    </div>
  );
}

export function CareersView() {
  const [open, setOpen] = useState<string | null>("R01");

  return (
    <>
      <section className="blk">
        <Head n="C.1" title="How we work" />
        <div className="arows">
          {VALUES.map(([n, h, p], i) => (
            <motion.div className="arow" key={n} {...rise} transition={{ duration: 0.6, ease: EASE, delay: 0.04 * i }}>
              <div className="n">{n}</div><div><h3>{h}</h3><p>{p}</p></div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="blk">
        <Head n="C.2" title="Open roles" />
        <div className="rl">
          <div className="rl-head mono" aria-hidden="true"><span>Index</span><span>Role</span><span>Team</span><span>Terms</span><span /></div>
          {ROLES.map((r, i) => {
            const on = open === r.code;
            return (
              <motion.div className={`rl-item${on ? " on" : ""}`} key={r.code} {...rise} transition={{ duration: 0.6, ease: EASE, delay: 0.04 * i }}>
                <button type="button" className="rl-row" aria-expanded={on} onClick={() => setOpen(on ? null : r.code)}>
                  <span className="rl-code mono">{r.code}</span>
                  <span className="rl-title display">{r.title}</span>
                  <span className="rl-team mono">{r.team}</span>
                  <span className="rl-type mono">{r.type}</span>
                  <i className="rl-plus" aria-hidden="true" />
                </button>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.div className="rl-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.45, ease: EASE }}>
                      <div className="rl-body-in">
                        <p>{r.blurb}</p>
                        <div>
                          <span className="mono rl-cap">We look for</span>
                          <ul>{r.looks.map((l) => <li key={l}>{l}</li>)}</ul>
                          <a className="mast-cta" href={`mailto:careers@lensai.app?subject=${encodeURIComponent(r.title)}`}><span>Apply for this role</span><span className="a" aria-hidden="true">→</span></a>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section className="blk">
        <Head n="C.3" title="What to expect" />
        <div className="cx">
          <div>
            <span className="mono cx-cap">The way we operate</span>
            {HOW.map(([h, p], i) => (
              <motion.div className="cx-row" key={h} {...rise} transition={{ duration: 0.6, ease: EASE, delay: 0.04 * i }}>
                <h3>{h}</h3><p>{p}</p>
              </motion.div>
            ))}
          </div>
          <div>
            <span className="mono cx-cap">The hiring process</span>
            <ol className="cx-steps">
              {PROCESS.map(([h, p], i) => (
                <motion.li key={h} {...rise} transition={{ duration: 0.6, ease: EASE, delay: 0.06 * i }}>
                  <span className="mono">{String(i + 1).padStart(2, "0")}</span>
                  <div><h3>{h}</h3><p>{p}</p></div>
                </motion.li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <motion.aside className="sheet-note sheet-cta" {...rise} transition={{ duration: 0.8, ease: EASE }}>
        <Marks />
        <span className="mono">No role that fits?</span>
        <h3 className="display">Tell us what you&apos;d build.</h3>
        <p>We still want to hear from exceptional people. Say what you would make here, and why LensAI.</p>
        <a className="mast-cta" href="mailto:careers@lensai.app?subject=General%20application"><span>Write to us</span><span className="a" aria-hidden="true">→</span></a>
      </motion.aside>

      <div className="doc-cta">
        <Link className="tlink" href="/whitepaper"><span>How the desk works</span><span className="a">→</span></Link>
        <Link className="tlink" href="/"><span>Back to home</span><span className="a">→</span></Link>
      </div>
    </>
  );
}
