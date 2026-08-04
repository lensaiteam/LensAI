import { loadLocalEnv } from "./_bootstrap";
import { getDb } from "../src/lib/capture/db/client";
import { runMigrations } from "../src/lib/capture/db/migrate";
import { normalizeAll } from "../src/lib/factors/normalize";
import { computeRegimes } from "../src/lib/factors/regimes";
import { runDivergence } from "../src/lib/divergence/engine";
import { slotFloor } from "../src/lib/factors/clock";
import { logger } from "../src/lib/capture/logger";

/**
 * Phase 4 divergence pass. Self-contained: computes the factor state (percentiles
 * + regimes) and the flags at ONE shared anchor, so the divergence read is aligned
 * point-in-time. Run `graph:load` first for the broken-relationship arm.
 */
loadLocalEnv();
const db = getDb();
runMigrations(db);
const asOf = Date.now();
const slot = slotFloor(asOf);

// Compute the factor state at this anchor, then the flags off it.
normalizeAll(db, { asOf, slot });
computeRegimes(db, { asOf, slot });
const rows = runDivergence(db, { asOf, slot });
const fired = rows.filter((r) => r.fired);
logger.info("diverge complete", {
  asOf,
  slot,
  total: rows.length,
  fired: fired.length,
  extreme: rows.filter((r) => r.kind === "extreme_state" && r.fired).length,
  broken: rows.filter((r) => r.kind === "broken_relationship" && r.fired).length,
  signatures: rows.filter((r) => r.kind === "structural_signature" && r.fired).length,
  indeterminate: rows.filter((r) => r.status === "indeterminate").length,
});
for (const r of fired) {
  const mag = typeof r.magnitude === "number" ? r.magnitude.toFixed(3) : "-";
  console.log(`  [${r.kind}] ${r.subject}${r.window_id ? " " + r.window_id : ""} — mag ${mag} (${r.vintage})`);
}
db.close();
