import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHead } from "@/components/site/PageHead";

export const metadata: Metadata = {
  title: "Whitepaper — LensAI",
  description: "How LensAI turns live market data and current news into decision-grade, non-advisory crypto analysis.",
};

const SECTIONS = [
  {
    h: "The problem",
    p: [
      "A language model does not know the current price of any token, or what happened this morning. Ask it directly and it will confidently narrate a stale, invented market. The facts that matter in crypto change by the minute.",
      "LensAI treats the model as a reasoning engine, not a source of truth. Everything time-sensitive is gathered at query time and handed to the model as evidence. The pipeline is the product; the model is swappable.",
    ],
  },
  {
    h: "The live-data pipeline",
    p: [
      "For every ticker we resolve the asset (Coinbase first, a market-data fallback second), then gather price, 24h/7d change, volume, market cap and supply in parallel with recent news and sentiment.",
      "That evidence is compressed to extracted numbers and a handful of attributed news summaries — never raw search dumps — and passed to the model under a strict template that produces six sections: snapshot, tokenomics, developments, sentiment, risk flags and an overall read.",
    ],
  },
  {
    h: "Non-advisory by construction",
    p: [
      "Users want a buy or sell answer. Giving one turns an analysis tool into unlicensed financial advice. LensAI instead lands every read on POSITIVE, MIXED or NEGATIVE current signals — with the reasoning, and both the bull and bear case on the table.",
      "The guardrails are enforced in the system prompt: never buy, sell, price targets or allocations; attribute every factual claim; and when data is thin, say so and raise it as a risk rather than filling the gap.",
    ],
  },
  {
    h: "Cost architecture",
    p: [
      "Crypto queries are power-law: the same top tokens, over and over. A per-ticker cache serves repeat requests for near-zero, a background job pre-computes the top assets on a schedule, and popular tokens read pre-fetched news instead of paying a per-search fee.",
      "Follow-up questions resolve from the data already gathered — sentiment, news, tokenomics, risk — before any new model call. The expensive step was paid once; a follow-up is re-presenting a slice you already hold.",
    ],
  },
  {
    h: "Identity & privacy",
    p: [
      "The account is a wallet address, proven by an off-chain signature (SIWE). No transaction, no gas, no keys on our servers — and no email, password or PII.",
      "Research history is treated as sensitive: the tickers a user studies hint at their holdings. Deletion is a first-class, one-action path. On-chain balances are never stored.",
    ],
  },
];

export default function Whitepaper() {
  return (
    <SiteShell>
      <div className="subpage lp-wrap">
        <PageHead index="01" kicker="Whitepaper" title="Read the signal, not the noise." sub="LensAI is a research instrument for crypto: decision-grade analysis synthesized from live market data and current news, and deliberately never financial advice." />

        <div className="doc">
          {SECTIONS.map((s, i) => (
            <section className="doc-sec" key={s.h}>
              <span className="doc-n mono">{String(i + 1).padStart(2, "0")}</span>
              <div className="doc-body">
                <h2 className="display">{s.h}</h2>
                {s.p.map((para, k) => <p key={k}>{para}</p>)}
              </div>
            </section>
          ))}
        </div>

        <div className="doc-cta">
          <Link className="tlink" href="/roadmap"><span>See the roadmap</span><span className="a">→</span></Link>
          <Link className="tlink" href="/app"><span>Open the desk</span><span className="a">→</span></Link>
        </div>
      </div>
    </SiteShell>
  );
}
