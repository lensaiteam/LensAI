import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHead } from "@/components/site/PageHead";
import { DocToc } from "@/components/site/DocToc";

export const metadata: Metadata = {
  title: "Whitepaper · LensAI",
  description: "How LensAI turns live market data and current news into clear, non-advisory crypto analysis.",
};

type Sec = { h: string; p: string[]; list?: string[]; id?: string };

const SECTIONS: Sec[] = [
  {
    h: "Abstract",
    p: [
      "LensAI is a research instrument for crypto. A user enters a ticker and receives a thorough analysis of that token, synthesized from live market data plus current news and sentiment. The output is designed to help a person judge whether a token currently looks attractive or risky, and it is explicitly not financial advice.",
      "This document describes how the system works: the live-data pipeline that grounds every answer, the non-advisory design that keeps the product on the right side of a hard regulatory line, the cost architecture that keeps it viable at scale, and the privacy model that stores almost nothing about the people who use it.",
    ],
  },
  {
    h: "The problem",
    p: [
      "A language model does not know the current price of any token, its market cap today, or what happened this morning. Ask it directly and it will confidently narrate a stale, invented market. The facts that matter in crypto change by the minute, and a model's training data is frozen months in the past.",
      "The naive fix, letting the model \"search the web\" on every request, is expensive, slow, and inconsistent. It also conflates two very different jobs: gathering current facts, and reasoning over them. LensAI separates the two. The model is a reasoning engine; the pipeline supplies the facts.",
    ],
  },
  {
    h: "Core principle: the pipeline is the product",
    p: [
      "The single most important idea in LensAI is that the live-data pipeline, not the model, is the moat. Any capable model can reason well over good evidence. What is hard, and what compounds over time, is gathering the right evidence cheaply, reliably, and fast for tens of thousands of assets.",
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
      "Quantitative data alone tells you what a token is doing, not why. Alongside market data, the pipeline pulls recent developments (catalysts, launches, partnerships, incidents) and reads the overall tone of coverage.",
      "For popular assets this news is pre-fetched by a background job and shared across all requests, so the marginal cost of a read is near zero. For the long tail, a strictly capped live search fills the gap. Every factual claim that reaches the user is attributed to its source.",
    ],
  },
  {
    h: "The analysis",
    p: [
      "Gathered evidence is compressed to extracted numbers and a handful of attributed summaries, never raw dumps, and passed to the model under a strict template. The output is a briefing, not a number, with six sections:",
    ],
    list: [
      "Snapshot: price, market cap, volume, moves and supply",
      "Tokenomics: supply model, concentration and unlock risk",
      "Recent developments: catalysts and incidents, each attributed",
      "Sentiment: the overall tone of coverage and social signal",
      "Risk flags: liquidity, volatility and security indicators",
      "Overall read: a POSITIVE / MIXED / NEGATIVE synthesis with both cases named",
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
      "A background job pre-computes the top assets on a schedule, so popular tokens are always warm, a fixed cost regardless of user count.",
      "Pre-fetched news removes the per-search fee for popular assets.",
      "Non-interactive pre-computation runs through a batch tier at a discount.",
      "Context is trimmed aggressively, and output is capped by a strict template.",
    ],
  },
  {
    h: "Follow-ups from stored data",
    p: [
      "The initial pipeline gathers more than it displays: sentiment, news, tokenomics and risk flags are all pulled up front and stored as structured fields. Most follow-up questions (\"what's the sentiment?\", \"what's the supply?\") can therefore be answered by reading a field back out, with no new model call and no new search.",
      "This is per-asset stored data, not per-user stored answers. The underlying facts about a token are the same for everyone and safe to re-serve; a user's private conversation is never replayed to anyone else.",
    ],
  },
  {
    h: "From instrument to desk",
    p: [
      "A single-token read answers one question. A research desk answers the question behind it: what is the market doing, and where does this token sit inside that? The engine underneath LensAI therefore reads six factor families together (funding, basis and yield, macro, institutional flows, market depth and news) and joins them on one clock.",
      "Each stream is normalized against its own history, so a reading is a percentile rather than a raw number, and each is tagged with the regime it sits in. A hand-curated mechanism graph records the documented transmission channels between factors. A divergence engine, pure arithmetic, flags states that are historically extreme and relationships that have broken. The model never finds the dots; it narrates the ones the engine measured.",
      "Everything is point-in-time. Every observation is content-hashed and appended, never updated, and every read is anchored to an as-of instant that cannot see anything captured after it. Lookahead is not discouraged; it is structurally impossible.",
    ],
  },
  {
    h: "The agents",
    id: "agents",
    p: [
      "The agents are nine ways of reaching that engine: ask it about the market, a token, an incident or a mechanism; ask what changed since you last looked; leave a standing watch; hand it a claim to check; read its own record; or connect an agent of your own to its tools.",
      "None of them is an open-ended tool loop. An agent plans once, gathers deterministically through the point-in-time tool layer, and makes at most one structured generation: a list of atomic claims, each typed as measured, mechanical or conjecture. That list then passes the same gates as every scheduled brief.",
    ],
    list: [
      "Every number, including one written only in the prose, must resolve to a store row, or the claim is dropped",
      "A mechanical claim must cite a real edge in the mechanism graph, or it is dropped",
      "Anything that reads as an instruction is dropped by the non-advisory filter",
      "If nothing survives, the agent retries once on a different model, then shows the measured state. It never guesses",
    ],
  },
  {
    h: "Spending model calls last",
    p: [
      "The state of the market is the same for every reader, so the Market State brief is generated once per hourly anchor and served to everyone. What changed since you last looked is a subtraction between two anchors. A standing watch is a rule evaluated over derived tables. The desk's track record is a read from an append-only table. None of these calls a model, which means none of them can hallucinate.",
      "A model is spent only where language is genuinely the job: translating a plain-language watch into a rule once, extracting claims from pasted text, and answering a specific question. The models sit behind a quota-aware router with failover, and each is admitted only after passing fixed cases through the real verification gates. When capacity runs out, the agents degrade to the measured state rather than to an error.",
    ],
  },
  {
    h: "Watches and claim checks",
    p: [
      "A watch is said once in plain language. A small model translates it into a rule over measured state, the desk echoes that rule back in exact terms, and the user confirms it. From then on it is arithmetic: evaluated once per anchor, fired only on the transition from false to true, bounded by a cooldown, and silent when data is missing. A watch can describe a state; it cannot encode an instruction, and price-level alerts are refused.",
      "A claim check inverts the usual trust. The model only extracts what a post asserts and maps each number to the store row that measures the same thing. The verdict (supported, contradicted with the store's value shown, or unverifiable) is computed, not judged. A causal claim counts as documented only when it maps to a real edge in the mechanism graph.",
    ],
  },
  {
    h: "What the agents keep about you",
    p: [
      "Agent state (conversations, watches and their trigger log, a watchlist of symbols, the anchor you last viewed, daily usage counts and hashed API keys) lives in the user database, cascades from the account, and is erased with it. An email address or Telegram chat id is held only if you turn that alert channel on.",
      "Two boundaries are enforced in code. No user identifier ever enters a model prompt: user text is scrubbed, and the model router refuses any prompt that still carries a wallet, an email or a known identifier. And nothing derived from a user ever enters the append-only corpus or the calibration record, because what cannot be deleted must never hold what a person may ask to erase.",
    ],
  },
  {
    h: "Identity & privacy",
    p: [
      "The account is a wallet address, proven by an off-chain signature (Sign-In With Ethereum). There is no transaction, no gas, and no private key ever touches our servers, and no email, password or other traditional personal information is collected.",
      "Research history is treated as sensitive, because the tickers a person studies hint at their holdings and intentions. On-chain balances are never stored, and deletion, of a single session or the whole account, is a first-class, one-action path.",
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
      "LensAI is only as good as the data it can gather. Third-party sources can be delayed, incomplete or wrong; obscure assets may have thin coverage; and sentiment is a read of tone, not a guarantee of outcome. The system is built to show these limits rather than paper over them.",
      "Crypto is highly volatile and you can lose money. LensAI provides information and analysis to support your own research. The decision is always yours.",
    ],
  },
];

const slug = (h: string) => h.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const TOC = SECTIONS.map((s, i) => ({ id: s.id ?? slug(s.h), n: String(i + 1).padStart(2, "0"), label: s.h }));

export default function Whitepaper() {
  return (
    <SiteShell>
      <div className="subpage lp-wrap">
        <PageHead index="02" kicker="Whitepaper" title="Read the signal, not the noise." sub="A research instrument for crypto: analysis built from live market data and current news, and deliberately never financial advice. This paper describes how it works." />

        <div className="doc-wrap">
        <DocToc items={TOC} />
        <article className="doc">
          {SECTIONS.map((s, i) => (
            <section className="doc-sec" key={s.h} id={TOC[i].id}>
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
        </article>
        </div>

        <div className="doc-cta">
          <Link className="tlink" href="/agents"><span>Explore the agents</span><span className="a">→</span></Link>
          <Link className="tlink" href="/roadmap"><span>See the roadmap</span><span className="a">→</span></Link>
          <Link className="tlink" href="/tokenomics"><span>Tokenomics</span><span className="a">→</span></Link>
          <Link className="tlink" href="/app"><span>Open the desk</span><span className="a">→</span></Link>
        </div>
      </div>
    </SiteShell>
  );
}
