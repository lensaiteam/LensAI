import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHead } from "@/components/site/PageHead";

export const metadata: Metadata = {
  title: "Careers — LensAI",
  description: "Build the live-data pipeline that is the product. Roles, how we work, and how to apply at LensAI.",
};

const VALUES = [
  { h: "The pipeline is the product", p: "We are obsessed with gathering the right evidence cheaply and fast. Everything else is downstream of that." },
  { h: "Honest by default", p: "We surface uncertainty instead of hiding it, in the product and in the way we work. No spin." },
  { h: "Small team, real ownership", p: "You own outcomes end to end. Fewer people, more surface area, more trust." },
  { h: "Ship, then sharpen", p: "We put things in front of users early and let reality tell us what to refine next." },
];

const ROLES = [
  { title: "Data Pipeline Engineer", team: "Engineering", type: "Remote · Full-time", blurb: "Own the live gather-and-cache pipeline — market data, news, and the cost architecture that keeps it near-zero at scale. Latency, correctness and price-per-read are your KPIs." },
  { title: "Frontend Engineer", team: "Product", type: "Remote · Full-time", blurb: "Craft the desk: streaming reads, motion, and a research UI that feels like an instrument, not a dashboard. Strong eye for detail and interaction." },
  { title: "Applied ML / Prompt Engineer", team: "Research", type: "Remote · Contract", blurb: "Tune the non-advisory analysis: guardrails, attribution, and the follow-up resolution that avoids new model calls. You measure quality, not vibes." },
  { title: "Product Designer", team: "Design", type: "Remote · Full-time", blurb: "Define the visual and interaction language across the site and the app. Editorial, restrained, and alive — you set the bar." },
];

const HOW = [
  ["Remote-first", "Work from wherever you do your best thinking. We overlap for a few core hours and otherwise optimize for deep work."],
  ["Async & written", "Decisions live in writing so anyone can catch up. Fewer meetings, clearer thinking."],
  ["Real ownership", "You pick up problems, not tickets, and see them through to users."],
  ["Fair equity", "Everyone shares in the upside. Compensation is transparent within the team."],
];

const PROCESS = [
  ["Intro", "A short call to trade context — what you've built, what we're building."],
  ["Deep dive", "A working session on a real problem in your area. No trick questions, no take-home marathons."],
  ["Meet the team", "Conversations with the people you'd work with day to day."],
  ["Offer", "A clear, written offer with transparent compensation and equity."],
];

export default function Careers() {
  return (
    <SiteShell>
      <div className="subpage lp-wrap">
        <PageHead index="04" kicker="Careers" title="Build the instrument." sub="LensAI is a small team obsessed with one idea: the live-data pipeline is the product. If that resonates, we'd like to meet you." />

        <h2 className="tk-h display">How we work</h2>
        <div className="rm-principles">
          {VALUES.map((v, i) => (
            <div className="rm-principle" key={v.h}>
              <span className="mono rm-pn">0{i + 1}</span>
              <h3>{v.h}</h3>
              <p>{v.p}</p>
            </div>
          ))}
        </div>

        <h2 className="tk-h display">Open roles</h2>
        <div className="roles">
          {ROLES.map((r) => (
            <div className="role" key={r.title}>
              <div className="role-main">
                <h3 className="display">{r.title}</h3>
                <p>{r.blurb}</p>
              </div>
              <div className="role-meta">
                <span className="mono">{r.team}</span>
                <span className="mono role-type">{r.type}</span>
                <a className="tlink" href={`mailto:careers@lensai.app?subject=${encodeURIComponent(r.title)}`}><span>Apply</span><span className="a">→</span></a>
              </div>
            </div>
          ))}
        </div>

        <h2 className="tk-h display">What to expect</h2>
        <div className="care-cols">
          <div className="care-col">
            <h4>The way we operate</h4>
            <div className="care-list">
              {HOW.map(([h, p]) => (
                <div className="care-item" key={h}><span className="care-h">{h}</span><span className="care-p">{p}</span></div>
              ))}
            </div>
          </div>
          <div className="care-col">
            <h4>The hiring process</h4>
            <div className="care-list">
              {PROCESS.map(([h, p], i) => (
                <div className="care-item" key={h}><span className="care-h"><span className="mono care-step">{i + 1}</span>{h}</span><span className="care-p">{p}</span></div>
              ))}
            </div>
          </div>
        </div>

        <div className="role-general">
          <h3 className="display">Don&apos;t see your role?</h3>
          <p>We still want to hear from exceptional people. Tell us what you&apos;d build and why LensAI.</p>
          <a className="tlink" href="mailto:careers@lensai.app?subject=General%20application"><span>Write to us</span><span className="a">→</span></a>
        </div>

        <div className="doc-cta">
          <Link className="tlink" href="/"><span>Back to home</span><span className="a">→</span></Link>
        </div>
      </div>
    </SiteShell>
  );
}
