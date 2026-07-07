import "server-only";
import { TRAILER_SENTINEL } from "./trailer";
import { SHORT_DISCLAIMER } from "./disclaimer";
import type { MarketData, NewsDigest } from "../types";

/**
 * NON-ADVISORY system prompt (CLAUDE.md §6). This is the product's #1 guardrail:
 * assess whether current signals look POSITIVE / MIXED / NEGATIVE — never tell
 * the user to buy or sell. Kept byte-stable so it prompt-caches.
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are LensAI, a crypto token research assistant. You produce decision-grade but strictly NON-ADVISORY analysis of a token from the live data provided plus current news you may search for.

HARD RULES — these are absolute:
- NEVER say "buy", "sell", "you should", "I recommend", "hold", "accumulate", or give a price target, entry/exit, or portfolio allocation.
- Frame the "Overall read" as an assessment of CURRENT SIGNALS (POSITIVE / MIXED / NEGATIVE), not a recommendation. Always present BOTH the bullish and bearish case.
- Attribute every factual claim drawn from news/web to its source.
- If data is thin or the token is obscure or unverifiable, say so plainly and raise the uncertainty as a risk — do not fill gaps with invented numbers.
- Use ONLY the market numbers given to you in the data block; do not fabricate prices, market cap, or supply.

OUTPUT FORMAT — respond in GitHub-flavored markdown with exactly these six sections, in order, each as a "## " heading:
## Snapshot
## Tokenomics
## Recent developments
## Sentiment
## Risk flags
## Overall read

- Keep the whole analysis tight (roughly 400–650 words).
- In "Overall read", use EXACTLY this structure so it can be rendered as a verdict panel:
  - First, a single bold line: **Signal: POSITIVE** (or MIXED / NEGATIVE).
  - Then a bold line **Bull case** followed by 2–3 "- " bullet points (each a short, self-contained point).
  - Then a bold line **Bear case** followed by 2–3 "- " bullet points.
  - Then one short synthesis paragraph weighing the two sides (still framed as current signals, never advice).
- End the prose with this exact disclaimer on its own line:
${SHORT_DISCLAIMER}

After the disclaimer, output the sentinel token ${TRAILER_SENTINEL} on its own line, then a single fenced \`\`\`json code block containing ONLY this shape (no prose after it):
{
  "signal": "POSITIVE" | "MIXED" | "NEGATIVE",
  "sentiment": { "overall": "POSITIVE"|"MIXED"|"NEGATIVE", "tone": "one sentence", "sources": ["..."] },
  "tokenomics": { "supplyModel": "...", "concentration": "...", "unlockRisk": "...", "notes": "..." },
  "risk_flags": [ { "level": "green"|"yellow"|"red", "label": "short flag" } ],
  "news": [ { "title": "...", "source": "...", "url": "...", "summary": "one line" } ],
  "citations": [ { "label": "source name", "url": "https://..." } ]
}
The trailer must be valid JSON. It restates the structured facts so they can be reused for follow-up questions without re-searching.`;

function fmtNum(n: number | null, opts?: { money?: boolean; pct?: boolean }): string {
  if (n === null || !Number.isFinite(n)) return "unknown";
  if (opts?.pct) return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
  if (opts?.money) {
    if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
    return `$${n.toLocaleString("en", { maximumFractionDigits: 2 })}`;
  }
  return n.toLocaleString("en");
}

/** Build the market-data context block (cached separately from the question). */
export function buildMarketBlock(m: MarketData): string {
  const lines = [
    `Ticker: ${m.symbol}`,
    `Name: ${m.name}`,
    m.unresolved
      ? "RESOLUTION: This ticker could NOT be resolved on Coinbase or CoinGecko. Treat it as obscure/unverifiable and raise that as a primary risk."
      : `Data source: ${m.source}`,
    `Price: ${m.priceDisplay}`,
    `24h change: ${fmtNum(m.change24hPct, { pct: true })}`,
    `7d change: ${fmtNum(m.change7dPct, { pct: true })}`,
    `24h volume: ${fmtNum(m.volume24h, { money: true })}`,
    `Market cap: ${fmtNum(m.marketCap, { money: true })}`,
    `Market-cap rank: ${m.rank ?? "unknown"}`,
    `Circulating supply: ${fmtNum(m.circulatingSupply)}`,
    `Total supply: ${fmtNum(m.totalSupply)}`,
    `Max supply: ${m.maxSupply === null ? "uncapped/unknown" : fmtNum(m.maxSupply)}`,
    `As of: ${m.asOf}`,
  ];
  return `<market_data>\n${lines.join("\n")}\n</market_data>`;
}

/** Build the pre-fetched news block for popular tokens (avoids metered search). */
export function buildNewsBlock(digest: NewsDigest | null): string {
  if (!digest || digest.items.length === 0) return "";
  const items = digest.items
    .slice(0, 6)
    .map((n, i) => `${i + 1}. ${n.title} — ${n.source}${n.url ? ` (${n.url})` : ""}${n.summary ? `\n   ${n.summary}` : ""}`)
    .join("\n");
  return `<prefetched_news as_of="${digest.asOf}">\n${items}\n</prefetched_news>\nUse this pre-fetched news instead of searching. Only search if it is clearly insufficient.`;
}

/** The final instruction turn (kept short; comes after the cached context). */
export function buildAnalysisInstruction(ticker: string, hasNews: boolean): string {
  return `Analyze ${ticker} now using the data above.${
    hasNews ? " News is pre-fetched above." : " Search the web (max 4 searches, 1–2 preferred) for the most recent news, catalysts, and sentiment."
  } Follow the required 6-section format and append the JSON trailer.`;
}
