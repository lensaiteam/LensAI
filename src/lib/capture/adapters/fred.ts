import type { FactorAdapter, FactorResult } from "./types";
import { captureConfig } from "../config";
import { httpJson } from "./http";

const BASE = "https://api.stlouisfed.org/fred/series/observations";

export interface FredObs { date: string; value: string }
interface FredResp { observations: FredObs[] }

/**
 * Pure: latest FRED observation -> a macro observation, or a recorded error.
 * observed_at is the FRED REFERENCE DATE (source-timed, lagging + revised — the
 * two-timestamp design absorbs both). A missing/unparseable print is an error,
 * NEVER fabricated (KEYS_NEEDED.md).
 */
export function mapFredLatest(
  p: { id: string; series: string; asset: string; stream: string },
  obs: FredObs | undefined,
): FactorResult {
  if (!obs) return { observations: [], errors: [`${p.id}: no observations returned`] };
  if (obs.value === "." || obs.value === "") {
    return { observations: [], errors: [`${p.id}: latest value missing for ${obs.date}`] };
  }
  const value = parseFloat(obs.value);
  if (!Number.isFinite(value)) return { observations: [], errors: [`${p.id}: unparseable value "${obs.value}"`] };

  const unit = p.stream === "macro_rate" ? "percent" : "index";
  return {
    observations: [
      {
        stream: p.stream,
        source: "fred",
        asset: p.asset,
        instrument: "",
        value,
        unit,
        observedAt: Date.parse(`${obs.date}T00:00:00Z`),
        metadata: { series: p.series, referenceDate: obs.date },
      },
    ],
    errors: [],
  };
}

export const fred: FactorAdapter = async (cfg): Promise<FactorResult> => {
  const key = captureConfig.fredApiKey();
  if (!key) return { observations: [], errors: [`${cfg.id}: FRED_API_KEY not set (see KEYS_NEEDED.md)`] };

  const series = (cfg.series as string) ?? "";
  if (!series) return { observations: [], errors: [`${cfg.id}: no 'series' configured`] };
  const asset = (cfg.asset as string) ?? series;

  const url = `${BASE}?series_id=${series}&api_key=${key}&file_type=json&sort_order=desc&limit=1`;
  try {
    const data = await httpJson<FredResp>(url);
    return mapFredLatest({ id: cfg.id, series, asset, stream: cfg.stream }, data.observations?.[0]);
  } catch (e) {
    return { observations: [], errors: [`${cfg.id}: ${(e as Error).message}`] };
  }
};
