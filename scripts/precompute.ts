/**
 * Standalone driver for the background top-token refresh (spec §4.2–4.4).
 * Calls the protected /api/cron/precompute endpoint rather than importing the
 * server-only libs directly. Run with a dev/prod server up:
 *
 *   CRON_SECRET=... APP_URL=http://localhost:3000 npm run precompute -- submit
 *   CRON_SECRET=... APP_URL=http://localhost:3000 npm run precompute -- collect <batchId>
 *
 * In production, schedule "submit" every 30–60 min and "collect" a few minutes
 * later (e.g. via Vercel Cron or an external scheduler hitting the same route).
 */
const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const SECRET = process.env.CRON_SECRET;

async function main() {
  if (!SECRET) throw new Error("CRON_SECRET env var is required");
  const [mode, batchId] = process.argv.slice(2);
  if (mode !== "submit" && mode !== "collect") {
    console.error("Usage: npm run precompute -- <submit|collect> [batchId]");
    process.exit(1);
  }

  const res = await fetch(`${APP_URL}/api/cron/precompute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}` },
    body: JSON.stringify(mode === "submit" ? { mode } : { mode, batchId }),
  });
  console.log(res.status, await res.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
