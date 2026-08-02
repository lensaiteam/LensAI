import { describe, it, expect } from "vitest";
import { parseRssXml } from "@/lib/capture/adapters/rss";
import { computeDepth } from "@/lib/capture/adapters/binance";
import { notImplemented, stubAdapters, NotImplementedError } from "@/lib/capture/adapters/stubs";
import type { ArticleSource } from "@/lib/capture/sources";

const cfg: ArticleSource = { id: "coindesk", name: "CoinDesk", type: "rss", url: "https://x.test/feed" };

const FIXTURE = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Test</title><language>en</language>
  <item>
    <title>BTC funding spikes</title>
    <link>https://x.test/a1</link>
    <guid>guid-1</guid>
    <pubDate>Wed, 02 Jul 2025 12:00:00 GMT</pubDate>
    <description>Funding &amp; basis widened as OI climbed.</description>
  </item>
  <item>
    <title>ETF flows steady</title>
    <link>https://x.test/a2</link>
    <guid>guid-2</guid>
    <pubDate>Wed, 02 Jul 2025 13:00:00 GMT</pubDate>
    <description>Inflows held.</description>
  </item>
</channel></rss>`;

describe("rss adapter (parseRssXml)", () => {
  it("parses items into ArticleInputs with published_at separate from capture", async () => {
    const { articles, errors } = await parseRssXml(FIXTURE, cfg);
    expect(errors).toEqual([]);
    expect(articles).toHaveLength(2);
    const a = articles[0];
    expect(a.source).toBe("coindesk");
    expect(a.url).toBe("https://x.test/a1");
    expect(a.guid).toBe("guid-1");
    expect(a.title).toBe("BTC funding spikes");
    expect(a.publishedAt).toBe(Date.parse("Wed, 02 Jul 2025 12:00:00 GMT"));
    expect(a.extractedText).toContain("basis");
  });

  it("reports a parse error rather than throwing", async () => {
    const { articles, errors } = await parseRssXml("not xml at all <<<", cfg);
    expect(articles).toEqual([]);
    expect(errors[0]).toMatch(/rss coindesk/);
  });
});

describe("binance computeDepth (pure)", () => {
  it("sums quote-notional within ±1% and ±2% of mid", () => {
    // mid = (99.9 + 100.1)/2 = 100. Levels chosen to fall in distinct bands.
    const d = computeDepth(
      [["99.9", "1"], ["99.2", "2"], ["98.5", "4"], ["97", "10"]],
      [["100.1", "1"], ["100.8", "3"], ["101.5", "5"], ["103", "10"]],
    );
    expect(d.mid).toBeCloseTo(100, 6);
    // 1% band [99,100]: 99.9 and 99.2 (98.5 excluded)
    expect(d.bid_1pct_usd).toBeCloseTo(99.9 * 1 + 99.2 * 2, 6);
    // 2% band [98,100]: adds 98.5 (97 excluded)
    expect(d.bid_2pct_usd).toBeCloseTo(99.9 * 1 + 99.2 * 2 + 98.5 * 4, 6);
    // 1% band [100,101]: 100.1 and 100.8 (101.5 excluded)
    expect(d.ask_1pct_usd).toBeCloseTo(100.1 * 1 + 100.8 * 3, 6);
    // 2% band [100,102]: adds 101.5 (103 excluded)
    expect(d.ask_2pct_usd).toBeCloseTo(100.1 * 1 + 100.8 * 3 + 101.5 * 5, 6);
    // The wider band always contains at least as much as the tighter one.
    expect(d.bid_2pct_usd).toBeGreaterThan(d.bid_1pct_usd);
    expect(d.ask_2pct_usd).toBeGreaterThan(d.ask_1pct_usd);
  });

  it("throws on an empty book (surfaces as a recorded error)", () => {
    expect(() => computeDepth([], [["1", "1"]])).toThrow(/empty order book/);
  });
});

describe("stubs never fabricate data", () => {
  it("throws NotImplementedError with the missing key", () => {
    expect(() => notImplemented("etf_flows", "ETF_FLOWS_API_KEY")).toThrow(NotImplementedError);
    expect(() => stubAdapters.etf_flows()).toThrow(/ETF_FLOWS_API_KEY/);
    expect(() => stubAdapters.institutional_depth()).toThrow(/never fabricate/i);
  });
});
