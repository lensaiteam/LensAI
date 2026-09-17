import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHead } from "@/components/site/PageHead";

export const metadata: Metadata = {
  title: "Roadmap — LensAI",
  description: "Where LensAI is and where it's going — the build order from live pipeline to open network.",
};

const PRINCIPLES = [
  { h: "Pipeline first", p: "Every phase strengthens the live-data pipeline before it adds surface area. The pipeline is the product; features are downstream of it." },
  { h: "Cost decoupled from users", p: "The expensive work — covering popular assets — is pre-computed and shared, so serving one more user costs almost nothing." },
  { h: "Non-advisory, always", p: "No phase ever ships a buy button. Everything we build assesses signals and presents both cases; the decision stays with the user." },
];

const PHASES = [
  {
    q: "Phase 01", state: "shipped", title: "The instrument",
    blurb: "Prove the core loop: sign in without friction, gather live data, and return an honest, attributed read.",
    points: [
      "Wallet sign-in (SIWE) — a signature, no gas, no PII",
      "Live market pipeline (primary source + fallback)",
      "Six-section, non-advisory analysis template",
      "Streaming reads with the POSITIVE / MIXED / NEGATIVE call",
      "Two free analyses per wallet, enforced server-side",
    ],
  },
  {
    q: "Phase 02", state: "active", title: "The desk",
    blurb: "Turn the instrument into a place you return to — fast, cheap, and with memory of what you've researched.",
    points: [
      "Per-ticker cache + scheduled top-token pre-compute",
      "Follow-ups resolved from stored fields, no new model call",
      "Pre-fetched news for popular assets to kill the search fee",
      "Research history, watchlist and reopenable sessions",
      "One-action account and per-session deletion",
    ],
  },
  {
    q: "Phase 03", state: "active", title: "The research desk & its agents",
    blurb: "Read the whole market, not one token at a time — then make that reading something you can put to work.",
    points: [
      "Built — immutable point-in-time capture across funding, basis, macro, flows, depth and news",
      "Built — every stream normalized against its own history, regime-tagged, joined on one clock",
      "Built — curated mechanism graph and a pure-arithmetic divergence engine",
      "Built — fail-closed narration: every number resolves to a store row or the claim is dropped",
      "Built — the agent API: ask, what changed, standing watches, claim check, the record, tool endpoint",
      "In build — the desk interface for the agents, and the always-on deployment",
    ],
  },
  {
    q: "Phase 04", state: "next", title: "Breadth & depth",
    blurb: "Cover more of the market, and go deeper on the assets that deserve it.",
    points: [
      "Long-tail token coverage via strictly-capped live search",
      "Model tiering — escalate to stronger models for complex assets",
      "Richer on-chain structure: holder maps, unlock calendars",
      "Portfolio-aware context, computed live and never stored",
      "Shareable, timestamped read snapshots",
    ],
  },
  {
    q: "Phase 05", state: "planned", title: "The network",
    blurb: "Open the desk up — to integrations, and to the community that uses it.",
    points: [
      "Typed claim extraction from the corpus — who said it, with what incentive",
      "Outcome scoring of divergence flags in the public calibration record",
      "Community coverage requests and prioritization",
      "Token utility and governance (see tokenomics)",
    ],
  },
  {
    q: "Phase 06", state: "planned", title: "The standard",
    blurb: "Make LensAI the reference layer other products build on top of.",
    points: [
      "Embeddable read widgets and partner integrations",
      "Multi-chain and cross-asset comparison",
      "Historical read archive to study how signals aged",
      "Transparency dashboard for methodology and sources",
    ],
  },
];

export default function Roadmap() {
  return (
    <SiteShell>
      <div className="subpage lp-wrap">
        <PageHead index="02" kicker="Roadmap" title="From instrument to network." sub="The build order is deliberate: get the live pipeline and the non-advisory read right first, decouple cost from users, then widen coverage and open the layer up. This is where we are and where we're going." />

        <div className="rm-principles">
          {PRINCIPLES.map((p, i) => (
            <div className="rm-principle" key={p.h}>
              <span className="mono rm-pn">P{i + 1}</span>
              <h3>{p.h}</h3>
              <p>{p.p}</p>
            </div>
          ))}
        </div>

        <div className="timeline">
          {PHASES.map((p) => (
            <div className={`tl-item ${p.state}`} key={p.q}>
              <div className="tl-marker"><span className="tl-dot" /></div>
              <div className="tl-card">
                <div className="tl-top">
                  <span className="mono tl-q">{p.q}</span>
                  <span className={`tl-state ${p.state}`}>{p.state}</span>
                </div>
                <h2 className="display">{p.title}</h2>
                <p className="tl-blurb">{p.blurb}</p>
                <ul>
                  {p.points.map((pt) => <li key={pt}>{pt}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <p className="rm-note">Timelines describe intent, not commitments. Priorities shift as the pipeline and the market teach us where the value is.</p>

        <div className="doc-cta">
          <Link className="tlink" href="/whitepaper"><span>Read the whitepaper</span><span className="a">→</span></Link>
          <Link className="tlink" href="/tokenomics"><span>Tokenomics</span><span className="a">→</span></Link>
          <Link className="tlink" href="/app"><span>Open the desk</span><span className="a">→</span></Link>
        </div>
      </div>
    </SiteShell>
  );
}
