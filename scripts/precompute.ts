/**
 * Standalone driver for the background top-token refresh (spec §4.2–4.3).
 * Calls the protected /api/cron/precompute endpoint rather than importing the
 * server-only libs directly. Run with a dev/prod server up:
 *
 *   CRON_SECRET=... APP_URL=http://localhost:3000 npm run precompute
 *   CRON_SECRET=... APP_URL=http://localhost:3000 npm run precompute -- BTC ETH SOL
 *
 * In production, schedule this every 30–60 min (e.g. Vercel Cron hitting the
 * same route). Optionally pass a token subset as CLI args.
 */
const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const SECRET = process.env.CRON_SECRET;

async function main() {
  if (!SECRET) throw new Error("CRON_SECRET env var is required");
  const tokens = process.argv.slice(2).map((t) => t.toUpperCase());

  const res = await fetch(`${APP_URL}/api/cron/precompute`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}` },
    body: JSON.stringify(tokens.length ? { tokens } : {}),
  });
  console.log(res.status, await res.text());
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
