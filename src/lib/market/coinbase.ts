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
  /** ~30 daily closes, oldest→newest, for a price sparkline. */
  sparkline: number[] | null;
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
  const history = await fetchHistory(product, price);

  return {
    symbol: symbol.toUpperCase(),
    price,
    change24hPct,
    change7dPct: history.change7dPct,
    volume24h: Number.isFinite(volume24h) ? volume24h * price : null, // volume is in base units
    sparkline: history.sparkline,
  };
}

/** A price series for the interactive chart: {t: unix secs, c: close},
 *  oldest→newest. Returns null when the ticker isn't a Coinbase product. */
export async function fetchCandleSeries(
  symbol: string,
  granularity: number,
  limit: number,
): Promise<{ t: number; c: number }[] | null> {
  try {
    const product = `${symbol.toUpperCase()}-USD`;
    const res = await cbFetch(`/products/${product}/candles?granularity=${granularity}`);
    if (!res.ok) return null;
    const candles = (await res.json()) as number[][];
    if (!Array.isArray(candles) || candles.length < 3) return null;
    return candles
      .slice(0, limit)
      .map((c) => ({ t: c[0], c: c[4] }))
      .filter((p) => Number.isFinite(p.c) && Number.isFinite(p.t))
      .reverse();
  } catch {
    return null;
  }
}

/** 7d change + ~30d sparkline from one daily-candle call.
 *  Candle shape: [time, low, high, open, close, volume], newest-first. */
async function fetchHistory(
  product: string,
  currentPrice: number,
): Promise<{ change7dPct: number | null; sparkline: number[] | null }> {
  try {
    const res = await cbFetch(`/products/${product}/candles?granularity=86400`);
    if (!res.ok) return { change7dPct: null, sparkline: null };
    const candles = (await res.json()) as number[][];
    if (!Array.isArray(candles) || candles.length < 8) return { change7dPct: null, sparkline: null };

    const weekAgoClose = candles[7]?.[4];
    const change7dPct =
      Number.isFinite(weekAgoClose) && weekAgoClose > 0
        ? ((currentPrice - weekAgoClose) / weekAgoClose) * 100
        : null;

    // Last ~30 daily closes, oldest→newest for a left-to-right sparkline.
    const spark = candles
      .slice(0, 30)
      .map((c) => c[4])
      .filter((n) => Number.isFinite(n))
      .reverse();

    return { change7dPct, sparkline: spark.length >= 5 ? spark : null };
  } catch {
    return { change7dPct: null, sparkline: null };
  }
}
