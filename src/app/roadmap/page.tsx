import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHead } from "@/components/site/PageHead";

export const metadata: Metadata = {
  title: "Roadmap — LensAI",
  description: "Where LensAI is and where it's going — the build order from live pipeline to open desk.",
};

const PHASES = [
  {
    q: "Phase 01", state: "shipped", title: "The instrument",
    points: ["Wallet sign-in (SIWE), no PII", "Live Coinbase + fallback data pipeline", "Six-section, non-advisory analysis", "Streaming reads with the POSITIVE / MIXED / NEGATIVE call"],
  },
  {
    q: "Phase 02", state: "active", title: "The desk",
    points: ["Per-ticker cache + top-token pre-compute", "Follow-ups resolved from stored fields", "Pre-fetched news for popular assets", "History, watchlist and account deletion"],
  },
  {
    q: "Phase 03", state: "next", title: "Breadth",
    points: ["Long-tail token coverage via metered search", "Model tiering for complex assets", "Portfolio-aware context, computed live — never stored", "Shareable read snapshots"],
  },
  {
    q: "Phase 04", state: "planned", title: "The network",
    points: ["Public API for the pipeline", "Alerting on signal changes", "Community coverage requests", "Token utility & governance (see tokenomics)"],
  },
];

export default function Roadmap() {
  return (
    <SiteShell>
      <div className="subpage lp-wrap">
        <PageHead index="02" kicker="Roadmap" title="From instrument to network." sub="The build order is deliberate: get the live pipeline and the non-advisory read right first, decouple cost from users, then widen coverage." />

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
                <ul>
                  {p.points.map((pt) => <li key={pt}>{pt}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="doc-cta">
          <Link className="tlink" href="/tokenomics"><span>Tokenomics</span><span className="a">→</span></Link>
          <Link className="tlink" href="/app"><span>Open the desk</span><span className="a">→</span></Link>
        </div>
      </div>
    </SiteShell>
  );
}
