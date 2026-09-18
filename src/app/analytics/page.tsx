import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHead } from "@/components/site/PageHead";
import { AnalyticsView } from "@/components/site/AnalyticsView";
import { getPlatformStats, getPlatformStatsFromExports } from "@/lib/stats";

export const metadata: Metadata = {
  title: "Analytics · LensAI",
  description: "What the platform has done, counted from its own records and refreshed hourly. Aggregates only.",
};

// The figures are computed in the database once an hour and served static in between.
export const revalidate = 3600;

export default async function Analytics({ searchParams }: { searchParams?: { preview?: string } }) {
  // /analytics?preview=1 in development renders the exported CSVs (same shape) for styling.
  const stats = (await getPlatformStats()) ?? (searchParams?.preview ? await getPlatformStatsFromExports() : null);
  return (
    <SiteShell>
      <div className="subpage lp-wrap">
        <PageHead
          index="05"
          kicker="Analytics"
          title="The desk, counted."
          sub="What the platform has done, from its own records, refreshed every hour. Aggregates only: wallets are counted, never listed, and nothing anyone asked is shown."
        />
        {stats ? (
          <AnalyticsView stats={stats} />
        ) : (
          <div className="led-empty">
            <span className="mono">no figures</span>
            <p>The ledger is not connected on this deployment yet, so there is nothing to show. This page never substitutes sample numbers for real ones.</p>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
