import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHead } from "@/components/site/PageHead";
import { TokenomicsView } from "@/components/site/TokenomicsView";

export const metadata: Metadata = {
  title: "Tokenomics — LensAI",
  description: "The planned $LENS token: supply, allocation, vesting, utility and value flow. Illustrative and subject to change.",
};

export default function Tokenomics() {
  return (
    <SiteShell>
      <div className="subpage lp-wrap">
        <PageHead index="04" kicker="Tokenomics" title="$LENS — the unit of the desk." sub="A utility token for metering reads, governing coverage and funding the live pipeline. Figures below are illustrative and subject to change before any launch." />
        <TokenomicsView />
      </div>
    </SiteShell>
  );
}
