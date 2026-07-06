import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHead } from "@/components/site/PageHead";

export const metadata: Metadata = {
  title: "Tokenomics — LensAI",
  description: "The planned $LENS token: supply, allocation and utility. Illustrative and subject to change.",
};

const ALLOC = [
  { label: "Community & rewards", pct: 40, tone: "a" },
  { label: "Treasury", pct: 20, tone: "b" },
  { label: "Team (4-yr vest)", pct: 18, tone: "c" },
  { label: "Liquidity", pct: 12, tone: "d" },
  { label: "Early backers", pct: 10, tone: "e" },
];

const UTILITY = [
  { h: "Reads & credits", p: "Beyond the free tier, analyses and force-refreshes are metered in $LENS — the network's unit of work." },
  { h: "Governance", p: "Holders steer coverage priorities, the pre-compute list and treasury spend on data sources." },
  { h: "Treasury flywheel", p: "A share of usage revenue funds the pipeline and buys back into the treasury, decoupling cost from users." },
];

export default function Tokenomics() {
  return (
    <SiteShell>
      <div className="subpage lp-wrap">
        <PageHead index="03" kicker="Tokenomics" title="$LENS — the unit of the desk." sub="A utility token for metering reads, governing coverage and funding the live pipeline. Figures below are illustrative and subject to change before any launch." />

        <div className="tk-supply">
          <div><span className="mono">TOTAL SUPPLY</span><b>1,000,000,000</b><span className="tk-tick mono">$LENS · fixed</span></div>
          <div><span className="mono">EMISSIONS</span><b>None</b><span className="tk-tick mono">no inflation</span></div>
          <div><span className="mono">INITIAL FLOAT</span><b>22%</b><span className="tk-tick mono">at listing</span></div>
        </div>

        <div className="tk-alloc">
          <div className="tk-bar">
            {ALLOC.map((a) => (
              <span key={a.label} className={`tk-seg t-${a.tone}`} style={{ width: `${a.pct}%` }} title={`${a.label} ${a.pct}%`} />
            ))}
          </div>
          <div className="tk-legend">
            {ALLOC.map((a) => (
              <div className="tk-row" key={a.label}>
                <span className={`tk-key t-${a.tone}`} />
                <span className="tk-label">{a.label}</span>
                <span className="tk-pct mono">{a.pct}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="tk-util">
          {UTILITY.map((u) => (
            <div className="tk-card" key={u.h}>
              <h3 className="display">{u.h}</h3>
              <p>{u.p}</p>
            </div>
          ))}
        </div>

        <div className="doc-cta">
          <Link className="tlink" href="/whitepaper"><span>Read the whitepaper</span><span className="a">→</span></Link>
          <Link className="tlink" href="/app"><span>Open the desk</span><span className="a">→</span></Link>
        </div>
      </div>
    </SiteShell>
  );
}
