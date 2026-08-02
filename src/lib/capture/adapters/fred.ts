import type { FactorAdapter, FactorResult } from "./types";
import type { ObservationInput } from "../types";
import { captureConfig } from "../config";
import { httpJson } from "./http";

const BASE = "https://api.stlouisfed.org/fred/series/observations";

interface FredResp {
  observations: { date: string; value: string }[];
}

/**
 * Macro series from FRED (e.g. DTWEXBGS = broad-dollar proxy for DXY, DGS10 = 10y).
 * observed_at is the FRED REFERENCE DATE (not the slot): the series is
 * source-timed and PUBLISHES WITH LAG, and FRED REVISES past values — the
 * two-timestamp design absorbs both (a revision reuses the date with a new value
 * and a later captured_at; OPEN_QUESTIONS Q3). No key -> a recorded error, never
 * fabricated data (KEYS_NEEDED.md).
 */
export const fred: FactorAdapter = async (cfg): Promise<FactorResult> => {
  const key = captureConfig.fredApiKey();
  if (!key) return { observations: [], errors: [`${cfg.id}: FRED_API_KEY not set (see KEYS_NEEDED.md)`] };

  const series = (cfg.series as string) ?? "";
  if (!series) return { observations: [], errors: [`${cfg.id}: no 'series' configured`] };
  const asset = (cfg.asset as string) ?? series;
  const unit = cfg.stream === "macro_rate" ? "percent" : "index";

  const url = `${BASE}?series_id=${series}&api_key=${key}&file_type=json&sort_order=desc&limit=1`;
  try {
    const data = await httpJson<FredResp>(url);
    const obs = data.observations?.[0];
    if (!obs) return { observations: [], errors: [`${cfg.id}: no observations returned`] };
    if (obs.value === "." || obs.value === "") {
      // FRED marks a missing print with ".". Record it as an error, do NOT invent.
      return { observations: [], errors: [`${cfg.id}: latest value missing for ${obs.date}`] };
    }
    const value = parseFloat(obs.value);
    if (!Number.isFinite(value)) return { observations: [], errors: [`${cfg.id}: unparseable value "${obs.value}"`] };

    const observation: ObservationInput = {
      stream: cfg.stream,
      source: "fred",
      asset,
      instrument: "",
      value,
      unit,
      observedAt: Date.parse(`${obs.date}T00:00:00Z`), // reference date, not slot
      metadata: { series, referenceDate: obs.date },
    };
    return { observations: [observation], errors: [] };
  } catch (e) {
    return { observations: [], errors: [`${cfg.id}: ${(e as Error).message}`] };
  }
};
