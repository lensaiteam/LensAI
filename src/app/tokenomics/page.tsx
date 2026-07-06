import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHead } from "@/components/site/PageHead";

export const metadata: Metadata = {
  title: "Tokenomics — LensAI",
  description: "The planned $LENS token: supply, allocation, vesting, utility and value flow. Illustrative and subject to change.",
};

const ALLOC = [
  { label: "Community & rewards", pct: 40, tone: "a" },
  { label: "Treasury", pct: 20, tone: "b" },
  { label: "Team (4-yr vest)", pct: 18, tone: "c" },
  { label: "Liquidity", pct: 12, tone: "d" },
  { label: "Early backers", pct: 10, tone: "e" },
];

const VEST = [
  ["Community & rewards", "Released over 48 months against usage and contribution — no upfront unlock."],
  ["Treasury", "Governance-controlled; spend requires a proposal. 12-month cliff, then linear."],
  ["Team", "12-month cliff, then linear over the following 36 months. Fully aligned to the long build."],
  ["Liquidity", "Unlocked at listing to seed healthy markets; paired and managed by the treasury."],
  ["Early backers", "12-month cliff, then linear over 24 months. No preferential unlock over the team."],
];

const UTILITY = [
  { h: "Reads & credits", p: "Beyond the free tier, analyses and force-refreshes are metered in $LENS — the network's unit of work." },
  { h: "Governance", p: "Holders steer coverage priorities, the pre-compute list, and treasury spend on data sources." },
  { h: "Treasury flywheel", p: "A share of usage revenue funds the pipeline and buys back into the treasury, decoupling cost from users." },
  { h: "Access tiers", p: "Staking unlocks higher rate limits, deeper history and early access to new coverage and features." },
];

const FLOW = [
  ["Usage", "Users spend credits on reads, refreshes and API calls."],
  ["Pipeline", "Revenue funds live data, news and compute — the real cost of coverage."],
  ["Treasury", "A share flows to the treasury and buys back $LENS, controlled by governance."],
  ["Holders", "Value returns to the network via rewards, access and a growing treasury."],
];

const FAQ = [
  ["Is there a token today?", "No. $LENS is a planned, future component described here for transparency. Everything on this page is illustrative and subject to change before any launch."],
  ["Is $LENS required to use LensAI?", "No. The core product works without it — the first analyses are free, and the token is a utility and coordination layer, not a paywall on the basics."],
  ["Will supply inflate?", "No. Supply is fixed at one billion with no emissions. Distribution happens by unlocking allocated supply on published schedules, not by minting new tokens."],
  ["How is this not financial advice?", "It isn't advice, and $LENS is not offered here for sale. This page explains a planned design; it is not a solicitation or a promise of value."],
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

        <h2 className="tk-h display">Allocation</h2>
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

        <h2 className="tk-h display">Vesting & unlocks</h2>
        <div className="tk-vest">
          {VEST.map(([label, note]) => (
            <div className="tk-vrow" key={label}>
              <span className="tk-vlabel">{label}</span>
              <span className="tk-vnote">{note}</span>
            </div>
          ))}
        </div>

        <h2 className="tk-h display">Utility</h2>
        <div className="tk-util">
          {UTILITY.map((u) => (
            <div className="tk-card" key={u.h}>
              <h3 className="display">{u.h}</h3>
              <p>{u.p}</p>
            </div>
          ))}
        </div>

        <h2 className="tk-h display">Value flow</h2>
        <div className="tk-flow">
          {FLOW.map(([h, p], i) => (
            <div className="tk-fnode" key={h}>
              <span className="mono tk-fn">{String(i + 1).padStart(2, "0")}</span>
              <h4>{h}</h4>
              <p>{p}</p>
              {i < FLOW.length - 1 && <span className="tk-farrow">→</span>}
            </div>
          ))}
        </div>

        <h2 className="tk-h display">Questions</h2>
        <div className="tk-faq">
          {FAQ.map(([q, a]) => (
            <div className="tk-qa" key={q}>
              <h4>{q}</h4>
              <p>{a}</p>
            </div>
          ))}
        </div>

        <p className="legal-foot">Nothing on this page is an offer to sell or a solicitation to buy any token, or a promise of future value. It describes a planned design for transparency only, and is not financial advice.</p>

        <div className="doc-cta">
          <Link className="tlink" href="/whitepaper"><span>Read the whitepaper</span><span className="a">→</span></Link>
          <Link className="tlink" href="/roadmap"><span>Roadmap</span><span className="a">→</span></Link>
          <Link className="tlink" href="/app"><span>Open the desk</span><span className="a">→</span></Link>
        </div>
      </div>
    </SiteShell>
  );
}
