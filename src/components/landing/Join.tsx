"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CHANNELS, EDGES, GRAPH_VERSION, NODES, type GraphEdge } from "@/lib/site/graph";
import { EASE, LineReveal, Marks, Sec } from "./kit";

/** Hand-placed so every edge has a clear run — the graph is small and curated, so is its drawing. */
const POS: Record<string, [number, number]> = {
  funding_rate: [120, 74], basis_trade: [450, 74], etf_arbitrage: [780, 74],
  stablecoin_float: [120, 196], spot_buying_power: [450, 196],
  dxy: [120, 300], real_yields: [120, 372], risk_appetite: [450, 336],
  market_depth: [120, 478], gap_risk: [450, 478],
};
const LANE_Y: Record<string, number> = { basis_arb: 30, dollar_liquidity: 152, macro_risk: 256, liquidity_risk: 434 };
const W = 176;
const H = 40;

/** Forward edges arc over, return edges arc under — so a two-way channel reads as a loop. */
function edgePath(e: GraphEdge): { d: string; mid: [number, number] } {
  const [sx, sy] = POS[e.src];
  const [dx, dy] = POS[e.dst];
  const forward = dx >= sx;
  const x1 = forward ? sx + W / 2 : sx - W / 2;
  const x2 = forward ? dx - W / 2 : dx + W / 2;
  const twoWay = EDGES.some((o) => o.src === e.dst && o.dst === e.src);
  const bow = twoWay ? (forward ? -30 : 30) : 0;
  const y1 = sy + (twoWay ? (forward ? -9 : 9) : 0);
  const y2 = dy + (twoWay ? (forward ? -9 : 9) : 0);
  const cx = (x1 + x2) / 2;
  return { d: `M${x1} ${y1} C${cx} ${y1 + bow}, ${cx} ${y2 + bow}, ${x2} ${y2}`, mid: [cx, (y1 + y2) / 2 + bow * 0.75] };
}

export function Join() {
  const [active, setActive] = useState<string>("funding_to_basis");
  const edge = EDGES.find((e) => e.id === active)!;
  const channel = CHANNELS.find((c) => c.id === edge.channel)!;
  const label = (id: string) => NODES.find((n) => n.id === id)!.label;

  return (
    <Sec n="01" label="The join" id="join">
      <LineReveal as="h2" className="display" lines={["Anyone can chart a factor.", <span key="d" className="dim">The join is the product.</span>]} />
      <motion.p className="intro" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: EASE, delay: 0.1 }}>
        This is the desk&apos;s mechanism graph, drawn exactly as it is curated: {NODES.length} nodes, {EDGES.length} directed edges, {CHANNELS.length} documented channels. A claim may call a link mechanical only if it cites one of these edges. Everything else must be measured, or say it is conjecture.
      </motion.p>

      <div className="jn">
        <div className="jn-canvas">
          <svg viewBox="0 0 900 520" role="img" aria-label="The curated mechanism graph">
            <defs>
              <marker id="jn-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M1 1 L9 5 L1 9" fill="none" stroke="context-stroke" strokeWidth="1.4" />
              </marker>
            </defs>

            {CHANNELS.map((c) => (
              <text key={c.id} x={32} y={LANE_Y[c.id]} className="jn-lane">{c.label}</text>
            ))}

            {EDGES.map((e, i) => {
              const { d, mid } = edgePath(e);
              const on = e.id === active;
              return (
                <g key={e.id} className={`jn-edge${on ? " on" : ""}${e.polarity === "negative" ? " neg" : ""}`} onMouseEnter={() => setActive(e.id)} onFocus={() => setActive(e.id)} onClick={() => setActive(e.id)} tabIndex={0} role="button" aria-label={`${label(e.src)} to ${label(e.dst)}, ${e.polarity}`} aria-pressed={on}>
                  <path d={d} className="jn-hit" />
                  <motion.path d={d} className="jn-line" markerEnd="url(#jn-arrow)" initial={{ pathLength: 0, opacity: 0 }} whileInView={{ pathLength: 1, opacity: 1 }} viewport={{ once: true, margin: "0px 0px -12% 0px" }} transition={{ duration: 1.25, ease: EASE, delay: 0.25 + i * 0.11 }} />
                  <g transform={`translate(${mid[0]} ${mid[1]})`}>
                    <circle r="9.5" className="jn-pol-bg" />
                    <text className="jn-pol" textAnchor="middle" dy="4">{e.polarity === "positive" ? "+" : "−"}</text>
                  </g>
                </g>
              );
            })}

            {NODES.map((n, i) => {
              const [x, y] = POS[n.id];
              const lit = n.id === edge.src || n.id === edge.dst;
              return (
                <motion.g key={n.id} className={`jn-node${lit ? " lit" : ""}${n.measured ? " measured" : ""}`} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "0px 0px -12% 0px" }} transition={{ duration: 0.7, ease: EASE, delay: 0.05 + i * 0.04 }}>
                  <rect x={x - W / 2} y={y - H / 2} width={W} height={H} />
                  <rect className="jn-key" x={x - W / 2 + 13} y={y - 3.5} width="7" height="7" />
                  <text x={x - W / 2 + 30} y={y + 4.5}>{n.label}</text>
                </motion.g>
              );
            })}
          </svg>
          <div className="jn-legend mono">
            <span><i className="k measured" />measured stream</span>
            <span><i className="k" />concept</span>
            <span><i className="l" />reinforces (+)</span>
            <span><i className="l neg" />opposes (−)</span>
          </div>
        </div>

        <aside className="jn-card" aria-live="polite">
          <Marks />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={edge.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.28, ease: EASE }}>
              <div className="jn-card-top mono"><span>{channel.label}</span><span>{GRAPH_VERSION}</span></div>
              <h3 className="jn-card-title">
                {label(edge.src)} <span className="jn-arrow" aria-hidden="true">{edge.polarity === "positive" ? "→ +" : "→ −"}</span> {label(edge.dst)}
              </h3>
              <p className="jn-card-body">{edge.mechanism}</p>
              <dl className="jn-card-kv mono">
                <div><dt>edge</dt><dd>{edge.id}</dd></div>
                <div><dt>strength</dt><dd>a curated prior, not a measurement</dd></div>
              </dl>
            </motion.div>
          </AnimatePresence>
        </aside>
      </div>
    </Sec>
  );
}
