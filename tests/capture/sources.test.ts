import { describe, it, expect } from "vitest";
import { loadSources, parseSources, enabledArticles } from "@/lib/capture/sources";

describe("sources config", () => {
  it("loads and validates config/sources.json (DoD: >=3 article, >=4 factor)", () => {
    const cfg = loadSources();
    expect(cfg.articles.length).toBeGreaterThanOrEqual(3);
    expect(cfg.factors.length).toBeGreaterThanOrEqual(4);
    for (const a of cfg.articles) expect(a.type).toBe("rss");
    for (const f of cfg.factors) expect(f.interval_sec).toBeGreaterThan(0);
  });

  it("adding a source is data-only — no code change required", () => {
    const cfg = parseSources({
      articles: [{ id: "newwire", name: "New Wire", type: "rss", url: "https://new.test/feed" }],
      factors: [
        { id: "kraken_funding", adapter: "krakenFunding", stream: "funding_rate", source: "kraken", interval_sec: 3600, custom: "ok" },
      ],
    });
    expect(cfg.articles[0].id).toBe("newwire");
    // .passthrough keeps adapter-specific keys.
    expect((cfg.factors[0] as Record<string, unknown>).custom).toBe("ok");
  });

  it("respects enabled:false", () => {
    const cfg = parseSources({
      articles: [
        { id: "on", name: "On", type: "rss", url: "https://a.test/f" },
        { id: "off", name: "Off", type: "rss", url: "https://b.test/f", enabled: false },
      ],
      factors: [],
    });
    expect(enabledArticles(cfg).map((a) => a.id)).toEqual(["on"]);
  });

  it("rejects a malformed source (missing url)", () => {
    expect(() => parseSources({ articles: [{ id: "x", name: "X", type: "rss" }], factors: [] })).toThrow();
  });

  it("rejects duplicate ids across sections", () => {
    expect(() =>
      parseSources({
        articles: [{ id: "dup", name: "A", type: "rss", url: "https://a.test/f" }],
        factors: [{ id: "dup", adapter: "x", stream: "s", source: "src", interval_sec: 60 }],
      }),
    ).toThrow(/duplicate/);
  });
});
