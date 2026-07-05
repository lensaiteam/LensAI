import "server-only";
import { env } from "../env";

/**
 * Coinbase Exchange public API (no auth needed) for price / 24h / 7d / volume.
 * Coinbase only covers listed assets and has NO market cap / supply — those come
 * from the CoinGecko fallback (see ./coingecko.ts). Returns null when the ticker
 * isn't a Coinbase product so the caller can fall back gracefully.
 */
export interface CoinbaseSnapshot {
  symbol: string;
  price: number;
  change24hPct: number | null;
  change7dPct: number | null;
  volume24h: number | null;
}

async function cbFetch(path: string): Promise<Response> {
  return fetch(`${env.coinbaseBase()}${path}`, {
    headers: { "User-Agent": "LensAI/1.0", Accept: "application/json" },
    // Market data is time-sensitive; never use Next's fetch cache here.
    cache: "no-store",
  });
}

export async function fetchCoinbase(symbol: string): Promise<CoinbaseSnapshot | null> {
  const product = `${symbol.toUpperCase()}-USD`;

  const [tickerRes, statsRes] = await Promise.all([
    cbFetch(`/products/${product}/ticker`),
    cbFetch(`/products/${product}/stats`),
  ]);

  // 404 => not a Coinbase product; let the caller fall back.
  if (tickerRes.status === 404 || statsRes.status === 404) return null;
  if (!tickerRes.ok || !statsRes.ok) return null;

  const ticker = (await tickerRes.json()) as { price?: string; volume?: string };
  const stats = (await statsRes.json()) as { open?: string; last?: string; volume?: string };

  const price = parseFloat(ticker.price ?? stats.last ?? "");
  if (!Number.isFinite(price)) return null;

  const open24 = parseFloat(stats.open ?? "");
  const change24hPct =
    Number.isFinite(open24) && open24 > 0 ? ((price - open24) / open24) * 100 : null;

  const volume24h = parseFloat(ticker.volume ?? stats.volume ?? "");

  return {
    symbol: symbol.toUpperCase(),
    price,
    change24hPct,
    change7dPct: await fetch7dChange(product, price),
    volume24h: Number.isFinite(volume24h) ? volume24h * price : null, // volume is in base units
  };
}

/** 7d change from daily candles: [time, low, high, open, close, volume]. */
async function fetch7dChange(product: string, currentPrice: number): Promise<number | null> {
  try {
    const res = await cbFetch(`/products/${product}/candles?granularity=86400`);
    if (!res.ok) return null;
    const candles = (await res.json()) as number[][];
    if (!Array.isArray(candles) || candles.length < 8) return null;
    // Candles are newest-first; index 7 ≈ 7 days ago. Close is index 4.
    const weekAgoClose = candles[7]?.[4];
    if (!Number.isFinite(weekAgoClose) || weekAgoClose <= 0) return null;
    return ((currentPrice - weekAgoClose) / weekAgoClose) * 100;
  } catch {
    return null;
  }
}
