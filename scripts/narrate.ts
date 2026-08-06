import { loadLocalEnv } from "./_bootstrap";
import { getDb } from "../src/lib/capture/db/client";
import { runMigrations } from "../src/lib/capture/db/migrate";
import { narrate } from "../src/lib/narrate/orchestrator";
import { persistBrief } from "../src/lib/narrate/briefs";
import { defaultProvider } from "../src/lib/narrate/generate";
import { MockProvider } from "../src/lib/narrate/provider";
import { logger } from "../src/lib/capture/logger";

/**
 * Phase 6 narration. Reads the latest computed factor state + graph via the
 * point-in-time tool layer, writes a non-advisory brief where every claim is
 * measured / mechanical / labeled-conjecture and every number resolves. Logs the
 * brief to the calibration record.
 *   narrate market                  (whole-market read)
 *   narrate token BTC               (token briefing)
 *   narrate market --mock           (no API key; empty brief — wiring check)
 * Run `diverge` first so factor state exists at the current anchor.
 */
async function main(): Promise<void> {
  loadLocalEnv();
  const args = process.argv.slice(2);
  const surface = args[0] === "token" ? "token" : args[0] === "incident" ? "incident" : "market";
  const asset = surface === "market" ? undefined : args[1];
  if (surface === "token" && !asset) {
    logger.error("usage: narrate token <ASSET>");
    process.exit(2);
  }
  const useMock = args.includes("--mock");

  const db = getDb();
  runMigrations(db);
  const provider = useMock ? new MockProvider({ headline: "(mock — no claims)", claims: [] }) : defaultProvider();

  const res = await narrate(db, provider, { surface, asset });
  persistBrief(db, res);
  logger.info("narrate complete", { surface, asset, kept: res.kept, dropped: res.dropped, provider: res.provider });
  console.log("\n" + res.text + "\n");
  db.close();
}

main().catch((e) => {
  logger.error("narrate fatal", { error: (e as Error).message });
  process.exit(1);
});
