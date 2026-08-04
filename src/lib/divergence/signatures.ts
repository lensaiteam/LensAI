import type { DivergenceFlag } from "./types";
import { worstVintage } from "./types";
import type { Vintage } from "../factors/stats";
import { OI_ELEVATED, OI_CALM, FUNDING_STRETCHED } from "./thresholds";

/**
 * Structural signatures v1 — a small, documented, CURATED arithmetic rule set over
 * percentiles + regimes (curation, not discovery; same discipline as regime tags).
 * v1 uses funding + open interest only (depth is not yet normalized to a scalar,
 * ETF flows are stubbed) — proxies, to be sharpened as those factors land.
 * Any missing/insufficient input yields `indeterminate`, never a fabricated read.
 */

const W = "365d";

export interface PctileLookup {
  percentile: number | null;
  status: "ok" | "insufficient_history";
  vintage: Vintage;
}

export interface SignatureContext {
  assets: string[];
  /** Percentile for the canonical-source series (engine resolves the source). */
  pctile(stream: string, asset: string, window: string): PctileLookup | null;
  /** Regime value (e.g. funding_regime -> "elevated"), or null/"unknown". */
  regime(key: string, asset: string): string | null;
}

function indeterminate(key: string, asset: string, reason: string, vintage: Vintage = "true_pit"): DivergenceFlag {
  return { kind: "structural_signature", subject: `${key}/${asset}`, window_id: "", fired: false, magnitude: null, status: "indeterminate", vintage, detail: { reason } };
}

export function computeSignatures(ctx: SignatureContext): DivergenceFlag[] {
  const out: DivergenceFlag[] = [];

  for (const asset of ctx.assets) {
    const fundingP = ctx.pctile("funding_rate", asset, W);
    const oiP = ctx.pctile("open_interest", asset, W);
    const fundingRegime = ctx.regime("funding_regime", asset);
    const regimeKnown = fundingRegime != null && fundingRegime !== "unknown";
    const oiOk = oiP != null && oiP.status === "ok" && oiP.percentile != null;
    const fundingOk = fundingP != null && fundingP.status === "ok" && fundingP.percentile != null;

    // leverage_led: funding regime elevated AND OI historically elevated.
    let leverageFired = false;
    if (!regimeKnown || !oiOk) {
      out.push(indeterminate("leverage_led", asset, "funding_regime or open_interest insufficient", oiP?.vintage ?? "true_pit"));
    } else {
      leverageFired = fundingRegime === "elevated" && oiP!.percentile! >= OI_ELEVATED;
      out.push({
        kind: "structural_signature", subject: `leverage_led/${asset}`, window_id: "", fired: leverageFired,
        magnitude: leverageFired ? oiP!.percentile! : 0, status: "ok", vintage: oiP!.vintage,
        detail: { funding_regime: fundingRegime, oi_percentile: oiP!.percentile, thresholds: { oi_elevated: OI_ELEVATED } },
      });
    }

    // spot_led: funding NOT elevated AND OI calm.
    if (!regimeKnown || !oiOk) {
      out.push(indeterminate("spot_led", asset, "funding_regime or open_interest insufficient", oiP?.vintage ?? "true_pit"));
    } else {
      const fired = fundingRegime !== "elevated" && oiP!.percentile! <= OI_CALM;
      out.push({
        kind: "structural_signature", subject: `spot_led/${asset}`, window_id: "", fired,
        magnitude: fired ? 1 - oiP!.percentile! : 0, status: "ok", vintage: oiP!.vintage,
        detail: { funding_regime: fundingRegime, oi_percentile: oiP!.percentile, thresholds: { oi_calm: OI_CALM } },
      });
    }

    // fragile: leverage_led AND funding stretched.
    if (!regimeKnown || !oiOk || !fundingOk) {
      out.push(indeterminate("fragile", asset, "inputs insufficient", worstVintage(oiP?.vintage ?? "true_pit", fundingP?.vintage ?? "true_pit")));
    } else {
      const fired = leverageFired && fundingP!.percentile! >= FUNDING_STRETCHED;
      out.push({
        kind: "structural_signature", subject: `fragile/${asset}`, window_id: "", fired,
        magnitude: fired ? fundingP!.percentile! : 0, status: "ok", vintage: worstVintage(oiP!.vintage, fundingP!.vintage),
        detail: { leverage_led: leverageFired, funding_percentile: fundingP!.percentile, thresholds: { funding_stretched: FUNDING_STRETCHED } },
      });
    }
  }

  return out;
}
