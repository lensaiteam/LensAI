import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHead } from "@/components/site/PageHead";

export const metadata: Metadata = {
  title: "Careers — LensAI",
  description: "Build the live-data pipeline that is the product. Open roles and general applications at LensAI.",
};

const ROLES = [
  { title: "Data Pipeline Engineer", team: "Engineering", type: "Remote · Full-time", blurb: "Own the live gather-and-cache pipeline — market data, news, and the cost architecture that keeps it near-zero at scale." },
  { title: "Frontend Engineer", team: "Product", type: "Remote · Full-time", blurb: "Craft the desk: streaming reads, motion, and a research UI that feels like an instrument, not a dashboard." },
  { title: "Applied ML / Prompt Engineer", team: "Research", type: "Remote · Contract", blurb: "Tune the non-advisory analysis: guardrails, attribution, and the follow-up resolution that avoids new model calls." },
];

export default function Careers() {
  return (
    <SiteShell>
      <div className="subpage lp-wrap">
        <PageHead index="04" kicker="Careers" title="Build the instrument." sub="LensAI is a small team obsessed with one idea: the live-data pipeline is the product. If that resonates, we'd like to meet you." />

        <div className="roles">
          {ROLES.map((r) => (
            <div className="role" key={r.title}>
              <div className="role-main">
                <h2 className="display">{r.title}</h2>
                <p>{r.blurb}</p>
              </div>
              <div className="role-meta">
                <span className="mono">{r.team}</span>
                <span className="mono role-type">{r.type}</span>
                <a className="tlink" href="mailto:careers@lensai.app?subject=Application"><span>Apply</span><span className="a">→</span></a>
              </div>
            </div>
          ))}
        </div>

        <div className="role-general">
          <h3 className="display">Don&apos;t see your role?</h3>
          <p>We still want to hear from exceptional people. Tell us what you&apos;d build.</p>
          <a className="tlink" href="mailto:careers@lensai.app?subject=General%20application"><span>Write to us</span><span className="a">→</span></a>
        </div>

        <div className="doc-cta">
          <Link className="tlink" href="/"><span>Back to home</span><span className="a">→</span></Link>
        </div>
      </div>
    </SiteShell>
  );
}
