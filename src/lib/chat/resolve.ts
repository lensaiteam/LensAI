import "server-only";
import type { CachedToken, NewsItem } from "../types";

/**
 * §5.4 stored-field resolver. Maps a follow-up to a structured field the initial
 * pipeline already gathered, and answers from it with NO model call and NO web
 * search. Returns null when the question doesn't map to a stored field (the
 * caller then falls through to a Haiku follow-up).
 *
 * This re-serves the TICKER's underlying facts (shared, safe) — never another
 * user's conversation.
 */
export type Field = "sentiment" | "news" | "tokenomics" | "risk" | "market";

export function classify(message: string): Field | null {
  const m = message.toLowerCase();
  if (/\b(sentiment|mood|bullish|bearish|vibe|feeling|social)\b/.test(m)) return "sentiment";
  if (/\b(news|recent|develop|happening|catalyst|update|announce|launch|partnership)\b/.test(m)) return "news";
  if (/\b(supply|tokenomic|circulating|inflation|unlock|vest|distribution|holder|concentrat|max supply)\b/.test(m))
    return "tokenomics";
  if (/\b(risk|red flag|danger|rug|scam|safe|security|liquidity|volatil)\b/.test(m)) return "risk";
  if (/\b(price|market cap|mcap|volume|worth|value|rank|how much)\b/.test(m)) return "market";
  return null;
}

function fmtNews(items: NewsItem[]): string {
  if (!items.length) return "No recent news items were gathered for this token.";
  return items
    .map((n) => `- **${n.title}** — ${n.source}${n.summary ? `\n  ${n.summary}` : ""}${n.url ? `\n  ${n.url}` : ""}`)
    .join("\n");
}

/** Answer from a stored field, or return null to fall through to a model call. */
export function resolveFromStored(cached: CachedToken, message: string): string | null {
  const field = classify(message);
  if (!field) return null;

  const asOf = new Date(cached.generated_at).toLocaleString();
  const stamp = `\n\n_As of ${asOf}._`;

  switch (field) {
    case "sentiment": {
      const s = cached.sentiment;
      if (!s) return null;
      return `**Sentiment (${s.overall}):** ${s.tone}${
        s.sources?.length ? `\n\nSources: ${s.sources.join(", ")}` : ""
      }${stamp}`;
    }
    case "news":
      return `**Recent news for ${cached.ticker}:**\n\n${fmtNews(cached.news_digest?.items ?? [])}${stamp}`;
    case "tokenomics": {
      const t = cached.tokenomics;
      if (!t) return null;
      return `**Tokenomics for ${cached.ticker}:**\n\n- Supply model: ${t.supplyModel}\n- Concentration: ${t.concentration}\n- Unlock risk: ${t.unlockRisk}${t.notes ? `\n- Notes: ${t.notes}` : ""}${stamp}`;
    }
    case "risk": {
      const flags = cached.risk_flags ?? [];
      if (!flags.length) return null;
      const body = flags.map((f) => `- ${f.level === "red" ? "🔴" : f.level === "yellow" ? "🟡" : "🟢"} ${f.label}`).join("\n");
      return `**Risk flags for ${cached.ticker}:**\n\n${body}${stamp}`;
    }
    case "market": {
      const m = cached.market_data;
      if (!m) return null;
      return `**Market snapshot for ${cached.ticker}:**\n\n- Price: ${m.priceDisplay}\n- 24h: ${m.change24hPct?.toFixed(2) ?? "?"}%\n- Market cap: ${
        m.marketCap ? "$" + m.marketCap.toLocaleString() : "unknown"
      }\n- 24h volume: ${m.volume24h ? "$" + m.volume24h.toLocaleString() : "unknown"}\n- Circulating supply: ${
        m.circulatingSupply?.toLocaleString() ?? "unknown"
      }${stamp}`;
    }
  }
}
