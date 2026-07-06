import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHead } from "@/components/site/PageHead";

export const metadata: Metadata = {
  title: "Whitepaper — LensAI",
  description: "How LensAI turns live market data and current news into decision-grade, non-advisory crypto analysis.",
};

type Sec = { h: string; p: string[]; list?: string[] };

const SECTIONS: Sec[] = [
  {
    h: "Abstract",
    p: [
      "LensAI is a research instrument for crypto. A user enters a ticker and receives a thorough, decision-grade analysis of that token, synthesized from live market data plus current news and sentiment. The output is designed to help a person judge whether a token currently looks attractive or risky — and it is explicitly not financial advice.",
      "This document describes how the system works: the live-data pipeline that grounds every answer, the non-advisory design that keeps the product on the right side of a hard regulatory line, the cost architecture that keeps it viable at scale, and the privacy model that stores almost nothing about the people who use it.",
    ],
  },
  {
    h: "The problem",
    p: [
      "A language model does not know the current price of any token, its market cap today, or what happened this morning. Ask it directly and it will confidently narrate a stale, invented market. The facts that matter in crypto change by the minute, and a model's training data is frozen months in the past.",
      "The naive fix — let the model \"search the web\" on every request — is expensive, slow, and inconsistent. It also conflates two very different jobs: gathering current facts, and reasoning over them. LensAI separates the two. The model is a reasoning engine; the pipeline supplies the facts.",
    ],
  },
  {
    h: "Core principle — the pipeline is the product",
    p: [
      "The single most important idea in LensAI is that the live-data pipeline, not the model, is the moat. Any capable model can reason well over good evidence. What is hard — and what compounds over time — is gathering the right evidence cheaply, reliably, and fast for tens of thousands of assets.",
      "Because the pipeline is model-agnostic, the underlying model can be swapped, upgraded or tiered without changing what makes LensAI valuable. The product improves as the pipeline improves.",
    ],
  },
  {
    h: "Resolving an asset",
    p: [
      "Every request begins by resolving the ticker or address the user typed. Resolution runs against a primary market-data source first, with a fallback for assets it does not cover, so that market-cap and supply figures can be filled in for the long tail.",
      "If an asset cannot be resolved or verified, LensAI says so plainly rather than guessing. An unverifiable token is itself a signal, and it is surfaced as a risk.",
    ],
  },
  {
    h: "Gathering live data",
    p: [
      "For a resolved asset the pipeline gathers, in parallel, the quantitative state of the market:",
    ],
    list: [
      "Current price and 24-hour / 7-day change",
      "Trading volume and liquidity depth",
      "Market capitalization and fully-diluted valuation",
      "Circulating and total supply, and notable unlock schedules",
      "Holder concentration and other on-chain structure where available",
    ],
  },
  {
    h: "News, developments & sentiment",
    p: [
      "Quantitative data alone tells you what a token is doing, not why. Alongside market data, the pipeline pulls recent developments — catalysts, launches, partnerships, incidents — and reads the overall tone of coverage.",
      "For popular assets this news is pre-fetched by a background job and shared across all requests, so the marginal cost of a read is near zero. For the long tail, a strictly capped live search fills the gap. Every factual claim that reaches the user is attributed to its source.",
    ],
  },
  {
    h: "The analysis",
    p: [
      "Gathered evidence is compressed to extracted numbers and a handful of attributed summaries — never raw dumps — and passed to the model under a strict template. The output is a briefing, not a number, with six sections:",
    ],
    list: [
      "Snapshot — price, market cap, volume, moves and supply",
      "Tokenomics — supply model, concentration and unlock risk",
      "Recent developments — catalysts and incidents, each attributed",
      "Sentiment — the overall tone of coverage and social signal",
      "Risk flags — liquidity, volatility and security indicators",
      "Overall read — an honest POSITIVE / MIXED / NEGATIVE synthesis, both cases named",
    ],
  },
  {
    h: "Non-advisory by construction",
    p: [
      "Users want a buy-or-sell answer. Giving one turns an analysis tool into unlicensed financial advice. LensAI instead assesses whether current signals look positive, mixed or negative, with the reasoning behind the call and both the bullish and bearish case on the table.",
      "The guardrails are enforced in the system prompt and cannot be prompted away by the user: never say buy, sell, you should, a price target or an allocation; frame the overall read as an assessment of current signals, not a recommendation; and when data is thin, raise the uncertainty as a risk rather than filling the gap.",
    ],
  },
  {
    h: "Cost architecture",
    p: [
      "Crypto queries follow a power law: the same top assets, requested over and over. A naive design pays full price to regenerate a near-identical answer every time. LensAI is built the opposite way.",
    ],
    list: [
      "A per-ticker cache serves repeat requests within a short window for almost nothing.",
      "A background job pre-computes the top assets on a schedule, so popular tokens are always warm — a fixed cost regardless of user count.",
      "Pre-fetched news removes the per-search fee for popular assets.",
      "Non-interactive pre-computation runs through a batch tier at a discount.",
      "Context is trimmed aggressively, and output is capped by a strict template.",
    ],
  },
  {
    h: "Follow-ups from stored data",
    p: [
      "The initial pipeline gathers more than it displays — sentiment, news, tokenomics and risk flags are all pulled up front and stored as structured fields. Most follow-up questions (\"what's the sentiment?\", \"what's the supply?\") can therefore be answered by reading a field back out, with no new model call and no new search.",
      "This is per-asset stored data, not per-user stored answers. The underlying facts about a token are the same for everyone and safe to re-serve; a user's private conversation is never replayed to anyone else.",
    ],
  },
  {
    h: "Identity & privacy",
    p: [
      "The account is a wallet address, proven by an off-chain signature (Sign-In With Ethereum). There is no transaction, no gas, and no private key ever touches our servers — and no email, password or other traditional personal information is collected.",
      "Research history is treated as sensitive, because the tickers a person studies hint at their holdings and intentions. On-chain balances are never stored, and deletion — of a single session or the whole account — is a first-class, one-action path.",
    ],
  },
  {
    h: "Security",
    p: [
      "All secrets live server-side and are never exposed to the browser. Login nonces are single-use and short-lived, and the signature is verified against the address, domain and chain before a session is issued. Requests are rate-limited per wallet, ticker input is validated, and the free tier is enforced on the server, never the client.",
    ],
  },
  {
    h: "Limitations",
    p: [
      "LensAI is only as good as the data it can gather. Third-party sources can be delayed, incomplete or wrong; obscure assets may have thin coverage; and sentiment is a read of tone, not a guarantee of outcome. The system is built to surface these limits honestly rather than paper over them.",
      "Crypto is highly volatile and you can lose money. LensAI provides information and analysis to support your own research — the decision is always yours.",
    ],
  },
];

export default function Whitepaper() {
  return (
    <SiteShell>
      <div className="subpage lp-wrap">
        <PageHead index="01" kicker="Whitepaper" title="Read the signal, not the noise." sub="A research instrument for crypto: decision-grade analysis synthesized from live market data and current news, and deliberately never financial advice. This paper describes how it works." />

        <div className="doc">
          {SECTIONS.map((s, i) => (
            <section className="doc-sec" key={s.h}>
              <span className="doc-n mono">{String(i + 1).padStart(2, "0")}</span>
              <div className="doc-body">
                <h2 className="display">{s.h}</h2>
                {s.p.map((para, k) => <p key={k}>{para}</p>)}
                {s.list && (
                  <ul className="doc-list">
                    {s.list.map((li) => <li key={li}>{li}</li>)}
                  </ul>
                )}
              </div>
            </section>
          ))}
        </div>

        <div className="doc-cta">
          <Link className="tlink" href="/roadmap"><span>See the roadmap</span><span className="a">→</span></Link>
          <Link className="tlink" href="/tokenomics"><span>Tokenomics</span><span className="a">→</span></Link>
          <Link className="tlink" href="/app"><span>Open the desk</span><span className="a">→</span></Link>
        </div>
      </div>
    </SiteShell>
  );
}
