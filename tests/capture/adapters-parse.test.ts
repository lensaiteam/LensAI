import { describe, it, expect } from "vitest";
import { parseFunding, parseOpenInterest, parseDepth, baseAsset } from "@/lib/capture/adapters/binance";
import { mapFunding, mapOpenInterest, type TickerItem } from "@/lib/capture/adapters/bybit";
import { parseSimplePrice } from "@/lib/capture/adapters/coingecko";
import { parseStablecoins } from "@/lib/capture/adapters/defillama";
import { mapFredLatest } from "@/lib/capture/adapters/fred";

const SLOT = 1_785_657_600_000;

describe("binance mappers (pure)", () => {
  it("baseAsset strips quote suffix", () => {
    expect(baseAsset("BTCUSDT")).toBe("BTC");
    expect(baseAsset("ETHUSDC")).toBe("ETH");
    expect(baseAsset("SOLUSD")).toBe("SOL");
  });

  it("parseFunding maps premiumIndex to a funding observation", () => {
    const o = parseFunding("BTCUSDT", { symbol: "BTCUSDT", markPrice: "68000.5", indexPrice: "67999.1", lastFundingRate: "0.0001", nextFundingTime: 1785664800000, time: 1785657600123 }, SLOT);
    expect(o).toMatchObject({ stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: 0.0001, unit: "rate_8h", observedAt: SLOT });
    expect((o.metadata as Record<string, unknown>).markPrice).toBe(68000.5);
  });

  it("parseOpenInterest maps openInterest", () => {
    const o = parseOpenInterest("ETHUSDT", { symbol: "ETHUSDT", openInterest: "123456.7", time: 1785657600000 }, SLOT);
    expect(o).toMatchObject({ stream: "open_interest", asset: "ETH", value: 123456.7, unit: "base" });
  });

  it("parseDepth embeds ±1%/±2% notional in metadata and null value", () => {
    const o = parseDepth("BTCUSDT", { bids: [["100", "1"], ["99", "2"]], asks: [["101", "1"], ["100.5", "3"]] }, SLOT);
    expect(o.stream).toBe("depth");
    expect(o.value).toBeNull();
    const m = o.metadata as Record<string, number>;
    expect(m.mid).toBeCloseTo(100.5, 6);
    expect(m.bid_1pct_usd).toBeGreaterThan(0);
    expect(m.ask_2pct_usd).toBeGreaterThanOrEqual(m.ask_1pct_usd);
  });
});

describe("bybit mappers (pure)", () => {
  const t: TickerItem = { symbol: "BTCUSDT", fundingRate: "0.00005", markPrice: "68010", openInterest: "5000.5", openInterestValue: "340000000", nextFundingTime: "1785664800000" };
  it("mapFunding", () => {
    const o = mapFunding("BTCUSDT", t, SLOT);
    expect(o).toMatchObject({ stream: "funding_rate", source: "bybit", asset: "BTC", value: 0.00005, observedAt: SLOT });
    expect((o.metadata as Record<string, unknown>).nextFundingTime).toBe(1785664800000);
  });
  it("mapOpenInterest carries USD value in metadata", () => {
    const o = mapOpenInterest("BTCUSDT", t, SLOT);
    expect(o).toMatchObject({ stream: "open_interest", value: 5000.5, unit: "base" });
    expect((o.metadata as Record<string, unknown>).openInterestValueUsd).toBe(340000000);
  });
});

describe("coingecko parseSimplePrice (pure)", () => {
  it("emits spot_price + spot_volume per id and reports missing ids", () => {
    const data = { bitcoin: { usd: 68000, usd_market_cap: 1.3e12, usd_24h_vol: 4.5e10, usd_24h_change: 2.1 } };
    const { observations, errors } = parseSimplePrice(["bitcoin", "ethereum"], data, SLOT);
    const btc = observations.filter((o) => o.asset === "bitcoin");
    expect(btc.map((o) => o.stream).sort()).toEqual(["spot_price", "spot_volume"]);
    expect(btc.find((o) => o.stream === "spot_price")!.value).toBe(68000);
    expect(errors).toContain("coingecko_spot ethereum: missing in response");
  });

  it("omits spot_volume when absent", () => {
    const { observations } = parseSimplePrice(["solana"], { solana: { usd: 150 } }, SLOT);
    expect(observations.map((o) => o.stream)).toEqual(["spot_price"]);
  });
});

describe("defillama parseStablecoins (pure)", () => {
  it("computes TOTAL float and top-2 by circulation", () => {
    const data = {
      peggedAssets: [
        { symbol: "USDT", name: "Tether", circulating: { peggedUSD: 100 } },
        { symbol: "USDC", name: "USD Coin", circulating: { peggedUSD: 60 } },
        { symbol: "DAI", name: "Dai", circulating: { peggedUSD: 5 } },
      ],
    };
    const { observations } = parseStablecoins(data, SLOT);
    const total = observations.find((o) => o.asset === "TOTAL")!;
    expect(total.value).toBe(165);
    expect(observations.filter((o) => o.asset !== "TOTAL").map((o) => o.asset)).toEqual(["USDT", "USDC"]);
  });

  it("errors on empty peggedAssets (never fabricates)", () => {
    expect(parseStablecoins({ peggedAssets: [] }, SLOT).errors[0]).toMatch(/empty/);
  });
});

describe("fred mapFredLatest (pure)", () => {
  const p = { id: "fred_10y", series: "DGS10", asset: "DGS10", stream: "macro_rate" };
  it("maps a value with observed_at = reference date", () => {
    const { observations } = mapFredLatest(p, { date: "2026-07-31", value: "4.35" });
    expect(observations[0]).toMatchObject({ stream: "macro_rate", source: "fred", asset: "DGS10", value: 4.35, unit: "percent" });
    expect(observations[0].observedAt).toBe(Date.parse("2026-07-31T00:00:00Z"));
  });
  it("records an error for a missing '.' print (never fabricates)", () => {
    const { observations, errors } = mapFredLatest(p, { date: "2026-07-31", value: "." });
    expect(observations).toHaveLength(0);
    expect(errors[0]).toMatch(/missing/);
  });
  it("uses index unit for macro_dxy", () => {
    const { observations } = mapFredLatest({ id: "fred_dxy", series: "DTWEXBGS", asset: "DXY", stream: "macro_dxy" }, { date: "2026-07-31", value: "121.4" });
    expect(observations[0].unit).toBe("index");
  });
});
