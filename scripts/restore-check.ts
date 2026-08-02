import Database from "better-sqlite3";

/**
 * Verify a restored corpus snapshot: integrity + that the amended DoD thresholds
 * hold (rows from >=3 article sources and >=4 factor streams). Read-only, so it
 * never creates -wal/-shm files on the snapshot. Exit non-zero on failure — this
 * is the gate in the RESTORE test (a backup never restored is a hope, not a backup).
 *
 *   node --import tsx scripts/restore-check.ts <db-file>
 */
const MIN_ARTICLE_SOURCES = 3;
const MIN_FACTOR_STREAMS = 4;

const path = process.argv[2];
if (!path) {
  console.error("usage: restore-check <db-file>");
  process.exit(2);
}

const db = new Database(path, { readonly: true, fileMustExist: true });
const integrity = String(db.pragma("integrity_check", { simple: true }));
const articles = (db.prepare("SELECT count(*) AS c FROM articles").get() as { c: number }).c;
const observations = (db.prepare("SELECT count(*) AS c FROM factor_observations").get() as { c: number }).c;
const sources = db.prepare("SELECT source, count(*) AS c FROM articles GROUP BY source ORDER BY source").all() as { source: string; c: number }[];
const streams = db.prepare("SELECT stream, count(*) AS c FROM factor_observations GROUP BY stream ORDER BY stream").all() as { stream: string; c: number }[];
db.close();

console.log(`integrity_check : ${integrity}`);
console.log(`articles=${articles}  observations=${observations}`);
console.log(`article sources (${sources.length}): ${sources.map((s) => `${s.source}=${s.c}`).join("  ") || "(none)"}`);
console.log(`factor streams  (${streams.length}): ${streams.map((s) => `${s.stream}=${s.c}`).join("  ") || "(none)"}`);

const problems: string[] = [];
if (integrity !== "ok") problems.push(`integrity_check != ok (${integrity})`);
if (sources.length < MIN_ARTICLE_SOURCES) problems.push(`article sources ${sources.length} < ${MIN_ARTICLE_SOURCES}`);
if (streams.length < MIN_FACTOR_STREAMS) problems.push(`factor streams ${streams.length} < ${MIN_FACTOR_STREAMS}`);

if (problems.length) {
  console.error("RESTORE CHECK FAILED: " + problems.join("; "));
  process.exit(1);
}
console.log("RESTORE CHECK PASSED");
