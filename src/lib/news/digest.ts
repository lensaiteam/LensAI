import "server-only";
import { env } from "../env";
import type { NewsDigest, NewsItem } from "../types";

/**
 * Assemble the NewsDigest to persist after an analysis. For the long tail the
 * items come from what the model surfaced via web search; for popular tokens
 * they come from the pre-fetched digest. Either way we record how it was
 * gathered and the search count so usage_log can validate §12 cost targets.
 */
export function buildDigest(
  items: NewsItem[],
  gatheredVia: NewsDigest["gatheredVia"],
  webSearchCount: number,
): NewsDigest {
  return {
    items: items.slice(0, 6),
    gatheredVia,
    webSearchCount,
    asOf: new Date().toISOString(),
  };
}

/**
 * Optional shared news pre-fetch for the top-token background job (CLAUDE.md
 * §4.3). Uses NEWS_API_* if configured; returns null when not set so the
 * pipeline falls back to metered web search. Wire your chosen crypto-news API
 * here (the shape below assumes a { articles: [...] } response).
 */
export async function prefetchNews(ticker: string): Promise<NewsDigest | null> {
  const base = env.newsBase();
  const key = env.newsKey();
  if (!base || !key) return null;

  try {
    const url = `${base}/everything?q=${encodeURIComponent(ticker + " crypto")}&pageSize=5&sortBy=publishedAt&apiKey=${key}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      articles?: { title: string; source?: { name?: string }; url: string; description?: string; publishedAt?: string }[];
    };
    const items: NewsItem[] = (data.articles ?? []).slice(0, 5).map((a) => ({
      title: a.title,
      source: a.source?.name ?? "news",
      url: a.url,
      summary: a.description ?? undefined,
      publishedAt: a.publishedAt,
    }));
    if (!items.length) return null;
    return { items, gatheredVia: "prefetched", webSearchCount: 0, asOf: new Date().toISOString() };
  } catch {
    return null;
  }
}
