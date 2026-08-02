import { loadLocalEnv } from "./_bootstrap";
import { getDb } from "../src/lib/capture/db/client";
import { runMigrations } from "../src/lib/capture/db/migrate";
import { normalizeAll } from "../src/lib/factors/normalize";
import { computeRegimes } from "../src/lib/factors/regimes";
import { slotFloor } from "../src/lib/factors/clock";
import { logger } from "../src/lib/capture/logger";

/**
 * Phase 2 normalize pass: compute per-window percentiles for every factor series
 * present as of now, then classify regime tags, writing the derived tables.
 * Anchored to now by default; re-runnable at a past instant for calibration.
 */
async function main(): Promise<void> {
  loadLocalEnv();
  const db = getDb();
  runMigrations(db);
  const asOf = Date.now();
  const slot = slotFloor(asOf);

  const pctls = normalizeAll(db, { asOf, slot });
  const regimes = computeRegimes(db, { asOf, slot });

  logger.info("normalize complete", {
    asOf,
    slot,
    percentiles: pctls.length,
    ok: pctls.filter((p) => p.status === "ok").length,
    insufficient: pctls.filter((p) => p.status === "insufficient_history").length,
    regimes: regimes.length,
  });

  // Human-readable Market-State-ish summary of the ok percentiles + regimes.
  for (const p of pctls.filter((x) => x.status === "ok")) {
    const pct = Math.round((p.percentile ?? 0) * 100);
    console.log(`  ${p.stream}/${p.asset} ${p.window_id}: ${pct}th pct (n=${p.n_obs}, ${p.vintage})`);
  }
  for (const r of regimes) console.log(`  regime ${r.regime_key} ${r.asset || "(market)"} = ${r.regime_value}`);
  db.close();
}

main().catch((e) => {
  logger.error("normalize fatal", { error: (e as Error).message });
  process.exit(1);
});
