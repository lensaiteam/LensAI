import { loadLocalEnv } from "./_bootstrap";
import { loadSeedFromFile } from "../src/lib/mechanism/loader";
import { getDb } from "../src/lib/capture/db/client";
import { runMigrations } from "../src/lib/capture/db/migrate";

/**
 * Validate the mechanism-graph seed (shape, referential integrity, regime keys,
 * non-advisory guardrail). CI-safe with no DB. With `--resolve`, additionally
 * check that article/claim evidence refs exist in the corpus — warnings only,
 * never a failure (amendment #5).
 */
const resolve = process.argv.includes("--resolve");

try {
  const { seed, checksum } = loadSeedFromFile();
  console.log(`OK  mechanism-graph "${seed.version}" — ${seed.nodes.length} nodes, ${seed.edges.length} edges, checksum ${checksum.slice(0, 12)}…`);

  if (resolve) {
    loadLocalEnv();
    const db = getDb();
    runMigrations(db);
    const hasArticle = db.prepare("SELECT 1 FROM articles WHERE content_hash = ? LIMIT 1");
    const hasClaimHash = db.prepare("SELECT 1 FROM claims WHERE content_hash = ? LIMIT 1");
    const hasClaimId = db.prepare("SELECT 1 FROM claims WHERE id = ? LIMIT 1");
    let refs = 0;
    let missing = 0;
    for (const e of seed.edges) {
      for (const ev of e.evidence ?? []) {
        if (ev.type === "external") continue;
        refs++;
        const found =
          ev.type === "article"
            ? hasArticle.get(ev.ref)
            : hasClaimHash.get(ev.ref) || (/^\d+$/.test(ev.ref) ? hasClaimId.get(Number(ev.ref)) : undefined);
        if (!found) {
          missing++;
          console.warn(`WARN edge ${e.id}: ${ev.type} evidence not found in corpus: ${ev.ref}`);
        }
      }
    }
    console.log(`resolve: ${refs} corpus evidence refs checked, ${missing} missing (warnings only)`);
    db.close();
  }
  process.exit(0);
} catch (e) {
  console.error(`INVALID: ${(e as Error).message}`);
  process.exit(1);
}
