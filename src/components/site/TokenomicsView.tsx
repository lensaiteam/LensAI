"use client";
import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { EASE, LineReveal, Marks } from "@/components/landing/kit";

const rise = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "0px 0px -10% 0px" } } as const;

/** Allocation. `shade` steps from ink to pale — red stays reserved for engine flags. */
const ALLOC = [
  { label: "Community & rewards", pct: 40, shade: "#0a0a0a" },
  { label: "Treasury", pct: 20, shade: "#3d3d3d" },
  { label: "Team", pct: 18, shade: "#767676" },
  { label: "Liquidity", pct: 12, shade: "#a6a6a6" },
  { label: "Early backers", pct: 10, shade: "#cfcfcf" },
] as const;

/** Vesting, in months from listing. `linear: null` = the schedule states "then linear" without a length. */
const HORIZON = 48;
const VEST = [
  { label: "Community & rewards", cliff: 0, linear: 48, note: "Released over 48 months against usage and contribution, with no upfront unlock." },
  { label: "Treasury", cliff: 12, linear: null, note: "Governance-controlled; spend requires a proposal. 12-month cliff, then linear." },
  { label: "Team", cliff: 12, linear: 36, note: "12-month cliff, then linear over the following 36 months. Fully aligned to the long build." },
  { label: "Liquidity", cliff: 0, linear: 0, note: "Unlocked at listing to seed healthy markets; paired and managed by the treasury." },
  { label: "Early backers", cliff: 12, linear: 24, note: "12-month cliff, then linear over 24 months. No preferential unlock over the team." },
] as const;

const UTILITY = [
  ["U.1", "Reads & credits", "Beyond the free tier, analyses and force-refreshes are metered in $LENS, the network's unit of work."],
  ["U.2", "Governance", "Holders steer coverage priorities, the pre-compute list, and treasury spend on data sources."],
  ["U.3", "Treasury flywheel", "A share of usage revenue funds the pipeline and buys back into the treasury, decoupling cost from users."],
  ["U.4", "Access tiers", "Staking unlocks higher rate limits, deeper history and early access to new coverage and features."],
] as const;

const FLOW = [
  ["Usage", "Users spend credits on reads, refreshes and API calls."],
  ["Pipeline", "Revenue funds live data, news and compute, the real cost of coverage."],
  ["Treasury", "A share flows to the treasury and buys back $LENS, controlled by governance."],
  ["Holders", "Value returns to the network via rewards, access and a growing treasury."],
] as const;

const FAQ = [
  ["Is there a token today?", "No. $LENS is a planned, future component described here for transparency. Everything on this page is illustrative and subject to change before any launch."],
  ["Is $LENS required to use LensAI?", "No. The core product works without it. The first analyses are free, and the token is a utility and coordination layer, not a paywall on the basics."],
  ["Will supply inflate?", "No. Supply is fixed at one billion with no emissions. Distribution happens by unlocking allocated supply on published schedules, not by minting new tokens."],
  ["How is this not financial advice?", "It isn't advice, and $LENS is not offered here for sale. This page explains a planned design; it is not a solicitation or a promise of value."],
] as const;

function Head({ n, title }: { n: string; title: string }) {
  return (
    <div className="blk-head">
      <span className="mono">{n}</span>
      <LineReveal as="h2" className="display" lines={[title]} />
    </div>
  );
}

export function TokenomicsView() {
  const [hot, setHot] = useState<number | null>(null);
  const [open, setOpen] = useState<number | null>(0);

  return (
    <>
      {/* status — the most important fact on the page, stated first */}
      <motion.div className="tk2-status mono" {...rise} transition={{ duration: 0.8, ease: EASE }}>
        <span className="tk2-flag">Planned · not live</span>
        <span>No token exists today. Every figure below is illustrative and may change before any launch. Nothing here is an offer.</span>
      </motion.div>

      <motion.div className="tk2-supply" {...rise} transition={{ duration: 0.8, ease: EASE, delay: 0.05 }}>
        <div><span className="mono">Total supply</span><b className="mono">1,000,000,000</b><em className="mono">$LENS · fixed</em></div>
        <div><span className="mono">Emissions</span><b className="mono">None</b><em className="mono">no inflation</em></div>
        <div><span className="mono">Initial float</span><b className="mono">22%</b><em className="mono">at listing</em></div>
      </motion.div>

      {/* ── allocation ── */}
      <section className="blk">
        <Head n="T.1" title="Allocation" />
        <div className="tk2-bar" role="img" aria-label="Allocation of the fixed supply">
          {ALLOC.map((a, i) => (
            <motion.span key={a.label} className={`tk2-seg${hot === i ? " hot" : ""}${hot !== null && hot !== i ? " cold" : ""}`} style={{ flexBasis: `${a.pct}%`, background: a.shade }} initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE, delay: 0.12 * i }} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)} />
          ))}
        </div>
        <div className="tk2-ledger">
          {ALLOC.map((a, i) => (
            <motion.div key={a.label} className={`tk2-lrow${hot === i ? " hot" : ""}`} {...rise} transition={{ duration: 0.6, ease: EASE, delay: 0.04 * i }} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}>
              <i style={{ background: a.shade }} aria-hidden="true" />
              <span className="tk2-lname">{a.label}</span>
              <span className="tk2-lpct mono">{a.pct}<small>%</small></span>
              <span className="tk2-lamt mono">{(a.pct * 10).toLocaleString("en-US")},000,000</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── vesting: drawn, not described ── */}
      <section className="blk">
        <Head n="T.2" title="Vesting & unlocks" />
        <div className="vs" role="table" aria-label="Vesting schedule in months from listing">
          <div className="vs-axis mono" aria-hidden="true">
            <span />
            <div>{[0, 12, 24, 36, 48].map((m) => <i key={m} style={{ left: `${(m / HORIZON) * 100}%` }}>{m === 0 ? "listing" : `${m}m`}</i>)}</div>
          </div>
          {VEST.map((v, i) => {
            const openEnded = v.linear === null;
            const len = v.linear ?? HORIZON - v.cliff;
            return (
              <motion.div className="vs-row" role="row" key={v.label} {...rise} transition={{ duration: 0.6, ease: EASE, delay: 0.05 * i }}>
                <span className="vs-label" role="rowheader">{v.label}</span>
                <div className="vs-track" role="cell">
                  {v.cliff > 0 && <span className="vs-cliff" style={{ left: 0, width: `${(v.cliff / HORIZON) * 100}%` }} title={`${v.cliff}-month cliff`} />}
                  {len > 0 ? (
                    <motion.span className={`vs-vest${openEnded ? " open" : ""}`} style={{ left: `${(v.cliff / HORIZON) * 100}%`, width: `${(len / HORIZON) * 100}%` }} initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 1.1, ease: EASE, delay: 0.2 + 0.08 * i }} />
                  ) : (
                    <span className="vs-tick" title="Unlocked at listing" />
                  )}
                </div>
                <p className="vs-note" role="cell">{v.note}</p>
              </motion.div>
            );
          })}
          <div className="vs-legend mono" aria-hidden="true">
            <span><i className="c" />cliff: nothing unlocks</span>
            <span><i className="v" />linear unlock</span>
            <span><i className="o" />linear, length set by governance</span>
            <span><i className="t" />unlocked at listing</span>
          </div>
        </div>
      </section>

      {/* ── utility ── */}
      <section className="blk">
        <Head n="T.3" title="Utility" />
        <div className="arows tk2-util">
          {UTILITY.map(([n, h, p], i) => (
            <motion.div className="arow" key={n} {...rise} transition={{ duration: 0.6, ease: EASE, delay: 0.04 * i }}>
              <div className="n">{n}</div><div><h3>{h}</h3><p>{p}</p></div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── value flow ── */}
      <section className="blk">
        <Head n="T.4" title="Value flow" />
        <ol className="fl">
          {FLOW.map(([h, p], i) => (
            <motion.li key={h} {...rise} transition={{ duration: 0.7, ease: EASE, delay: 0.1 * i }}>
              <span className="fl-n mono">{String(i + 1).padStart(2, "0")}</span>
              <motion.i className="fl-line" aria-hidden="true" initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, ease: EASE, delay: 0.25 + 0.14 * i }} />
              <h3>{h}</h3>
              <p>{p}</p>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* ── questions ── */}
      <section className="blk">
        <Head n="T.5" title="Questions" />
        <div className="qa">
          {FAQ.map(([q, a], i) => {
            const on = open === i;
            return (
              <div className={`qa-item${on ? " on" : ""}`} key={q}>
                <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : i)}>
                  <span className="mono">Q.{i + 1}</span>
                  <b>{q}</b>
                  <i aria-hidden="true" />
                </button>
                <AnimatePresence initial={false}>
                  {on && (
                    <motion.div className="qa-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }}>
                      <p>{a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </section>

      <motion.aside className="sheet-note" {...rise} transition={{ duration: 0.8, ease: EASE }}>
        <Marks />
        <span className="mono">Read this</span>
        <p>Nothing on this page is an offer to sell or a solicitation to buy any token, or a promise of future value. It describes a planned design for transparency only, and is not financial advice.</p>
      </motion.aside>

      <div className="doc-cta">
        <Link className="tlink" href="/whitepaper"><span>Read the whitepaper</span><span className="a">→</span></Link>
        <Link className="tlink" href="/roadmap"><span>Roadmap</span><span className="a">→</span></Link>
        <Link className="tlink" href="/app"><span>Open the desk</span><span className="a">→</span></Link>
      </div>
    </>
  );
}
