import { loadLocalEnv } from "./_bootstrap";
import { getDb } from "../src/lib/capture/db/client";
import { runMigrations } from "../src/lib/capture/db/migrate";
import { lastSuccessPerSource, lastRunPerSource, recentRuns } from "../src/lib/capture/db/runs";

/**
 * "Watch rows land" + gap visibility. Shows corpus counts, the last SUCCESSFUL
 * run per source (a stale timestamp = a gap), and the most recent runs incl.
 * errors. Read-only over operational tables.
 */
loadLocalEnv();
const db = getDb();
runMigrations(db);

const now = Date.now();
const fmtAge = (t: number | null) => (t == null ? "never" : `${Math.round((now - t) / 1000)}s ago`);

const articles = (db.prepare("SELECT count(*) c FROM articles").get() as { c: number }).c;
const observations = (db.prepare("SELECT count(*) c FROM factor_observations").get() as { c: number }).c;
const bySource = db
  .prepare("SELECT source, count(*) c FROM articles GROUP BY source ORDER BY source")
  .all() as { source: string; c: number }[];
const byStream = db
  .prepare("SELECT stream, count(*) c FROM factor_observations GROUP BY stream ORDER BY stream")
  .all() as { stream: string; c: number }[];

console.log(`\nCORPUS  articles=${articles}  observations=${observations}`);
console.log("  articles by source:", bySource.map((r) => `${r.source}=${r.c}`).join("  ") || "(none)");
console.log("  observations by stream:", byStream.map((r) => `${r.stream}=${r.c}`).join("  ") || "(none)");

const success = new Map(lastSuccessPerSource(db).map((r) => [r.source, r]));
console.log("\nLAST SUCCESS PER SOURCE");
for (const r of lastRunPerSource(db)) {
  const ok = success.get(r.source);
  console.log(
    `  ${(r.source ?? "?").padEnd(14)} last=${r.status.padEnd(8)} ${fmtAge(r.started_at)}` +
      `  lastSuccess=${ok ? fmtAge(ok.started_at) : "NEVER"}` +
      (r.status === "error" && r.error ? `  err="${r.error.slice(0, 80)}"` : ""),
  );
}

console.log("\nRECENT RUNS");
for (const r of recentRuns(db, 15)) {
  console.log(
    `  ${new Date(r.started_at).toISOString()}  ${r.job.padEnd(28)} ${r.status.padEnd(8)}` +
      ` w=${r.rows_written} d=${r.rows_deduped}` +
      (r.error ? `  err="${r.error.slice(0, 80)}"` : ""),
  );
}
console.log("");
db.close();
