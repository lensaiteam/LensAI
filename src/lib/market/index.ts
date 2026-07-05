import "server-only";
import { fetchCoinbase } from "./coinbase";
import { fetchCoingecko } from "./coingecko";
import type { MarketData } from "../types";

/** Validate + normalize a user-supplied ticker (spec §13). */
export function normalizeTicker(raw: string): string | null {
  const t = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (t.length < 1 || t.length > 12) return null;
  return t;
}

function formatPrice(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return "N/A";
  if (p >= 1) return "$" + p.toLocaleString("en", { maximumFractionDigits: 2 });
  if (p >= 0.01) return "$" + p.toFixed(4);
  return "$" + p.toFixed(8).replace(/0+$/, "");
}

/**
 * Gather the market snapshot with graceful fallback (spec §3, §5.2):
 *   - Coinbase primary (price / 24h / 7d / volume)
 *   - CoinGecko fallback for market cap + supply, and to resolve tickers
 *     Coinbase doesn't list.
 * Never throws for an unknown ticker — returns `unresolved: true` instead.
 */
export async function gatherMarketData(ticker: string): Promise<MarketData> {
  const asOf = new Date().toISOString();

  const [coinbase, coingecko] = await Promise.allSettled([
    fetchCoinbase(ticker),
    fetchCoingecko(ticker),
  ]);

  const cb = coinbase.status === "fulfilled" ? coinbase.value : null;
  const cg = coingecko.status === "fulfilled" ? coingecko.value : null;

  if (!cb && !cg) {
    return {
      name: ticker,
      symbol: ticker,
      price: null,
      priceDisplay: "N/A",
      change24hPct: null,
      change7dPct: null,
      volume24h: null,
      marketCap: null,
      circulatingSupply: null,
      totalSupply: null,
      maxSupply: null,
      rank: null,
      source: "coinbase+coingecko",
      unresolved: true,
      asOf,
    };
  }

  // Prefer Coinbase for live price/volume; CoinGecko for mcap/supply + as backup.
  const price = cb?.price ?? cg?.price ?? null;
  const source: MarketData["source"] =
    cb && cg ? "coinbase+coingecko" : cb ? "coinbase" : "coingecko";

  return {
    name: cg?.name ?? ticker,
    symbol: cg?.symbol || ticker,
    price,
    priceDisplay: formatPrice(price),
    change24hPct: cb?.change24hPct ?? cg?.change24hPct ?? null,
    change7dPct: cb?.change7dPct ?? cg?.change7dPct ?? null,
    volume24h: cb?.volume24h ?? cg?.volume24h ?? null,
    marketCap: cg?.marketCap ?? null,
    circulatingSupply: cg?.circulatingSupply ?? null,
    totalSupply: cg?.totalSupply ?? null,
    maxSupply: cg?.maxSupply ?? null,
    rank: cg?.rank ?? null,
    source,
    unresolved: false,
    asOf,
  };
}
