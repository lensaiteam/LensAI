import "server-only";
import { env } from "../env";

/**
 * CoinGecko fallback (spec §3): resolves unknown tickers and supplies the
 * market cap + circulating/total supply Coinbase lacks. Works keyless at public
 * rate limits; a demo/pro key raises them.
 */
export interface CoingeckoSnapshot {
  id: string;
  name: string;
  symbol: string;
  price: number | null;
  change24hPct: number | null;
  change7dPct: number | null;
  volume24h: number | null;
  marketCap: number | null;
  circulatingSupply: number | null;
  totalSupply: number | null;
  maxSupply: number | null;
  rank: number | null;
}

function cgFetch(path: string): Promise<Response> {
  const key = env.coingeckoKey();
  const headers: Record<string, string> = { Accept: "application/json", "User-Agent": "LensAI/1.0" };
  if (key) headers["x-cg-demo-api-key"] = key;
  return fetch(`${env.coingeckoBase()}${path}`, { headers, cache: "no-store" });
}

/** Resolve a ticker symbol/name to a CoinGecko coin id (best liquidity match). */
export async function resolveCoingeckoId(query: string): Promise<string | null> {
  const res = await cgFetch(`/search?query=${encodeURIComponent(query.trim())}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { coins?: { id: string; symbol: string; market_cap_rank: number | null }[] };
  const coins = data.coins ?? [];
  if (!coins.length) return null;

  const q = query.trim().toLowerCase();
  // Prefer an exact symbol match with the best (lowest) market-cap rank.
  const exact = coins
    .filter((c) => c.symbol.toLowerCase() === q)
    .sort((a, b) => (a.market_cap_rank ?? 1e9) - (b.market_cap_rank ?? 1e9));
  return (exact[0] ?? coins[0]).id;
}

export async function fetchCoingecko(query: string): Promise<CoingeckoSnapshot | null> {
  const id = await resolveCoingeckoId(query);
  if (!id) return null;

  const res = await cgFetch(
    `/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`,
  );
  if (!res.ok) return null;
  const d = (await res.json()) as any;
  const md = d.market_data ?? {};

  return {
    id,
    name: d.name ?? id,
    symbol: (d.symbol ?? "").toUpperCase(),
    price: md.current_price?.usd ?? null,
    change24hPct: md.price_change_percentage_24h ?? null,
    change7dPct: md.price_change_percentage_7d ?? null,
    volume24h: md.total_volume?.usd ?? null,
    marketCap: md.market_cap?.usd ?? null,
    circulatingSupply: md.circulating_supply ?? null,
    totalSupply: md.total_supply ?? null,
    maxSupply: md.max_supply ?? null,
    rank: d.market_cap_rank ?? null,
  };
}
