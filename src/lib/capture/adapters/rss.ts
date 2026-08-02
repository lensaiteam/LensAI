import Parser from "rss-parser";
import type { ArticleAdapter, ArticleResult } from "./types";
import type { ArticleSource } from "../sources";
import type { ArticleInput } from "../types";
import { httpText } from "./http";

const parser = new Parser();

/** Parse RSS/Atom XML into ArticleInputs. Pure (no network) — the unit-test seam. */
export async function parseRssXml(xml: string, cfg: ArticleSource): Promise<ArticleResult> {
  const articles: ArticleInput[] = [];
  const errors: string[] = [];
  try {
    const feed = await parser.parseString(xml);
    for (const item of feed.items ?? []) {
      const anyItem = item as Record<string, unknown>;
      const text =
        item.contentSnippet ||
        (anyItem["content:encoded"] as string) ||
        item.content ||
        (anyItem.summary as string) ||
        item.title ||
        "";
      if (!text) {
        errors.push(`rss ${cfg.id}: item with no content (${item.link ?? "no link"})`);
        continue;
      }
      const publishedAt = parseDate(item.isoDate) ?? parseDate(item.pubDate);
      articles.push({
        source: cfg.id,
        url: item.link ?? cfg.url,
        guid: item.guid ?? (anyItem.id as string) ?? null,
        title: item.title ?? null,
        author: item.creator ?? (anyItem.author as string) ?? null,
        publishedAt,
        rawHtml: (anyItem["content:encoded"] as string) ?? item.content ?? null,
        extractedText: text,
        lang: (feed.language as string) ?? null,
      });
    }
  } catch (e) {
    errors.push(`rss ${cfg.id}: parse failed — ${(e as Error).message}`);
  }
  return { articles, errors };
}

function parseDate(v: string | undefined): number | null {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

export const rssAdapter: ArticleAdapter = async (cfg) => {
  try {
    const xml = await httpText(cfg.url);
    return await parseRssXml(xml, cfg);
  } catch (e) {
    return { articles: [], errors: [`rss ${cfg.id}: fetch failed — ${(e as Error).message}`] };
  }
};
