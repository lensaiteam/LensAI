import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHead } from "@/components/site/PageHead";
import { CareersView } from "@/components/site/CareersView";

export const metadata: Metadata = {
  title: "Careers · LensAI",
  description: "Build the research desk. Roles, how we work, and how to apply at LensAI.",
};

export default function Careers() {
  return (
    <SiteShell>
      <div className="subpage lp-wrap">
        <PageHead index="05" kicker="Careers" title="Build the instrument." sub="LensAI is a small team building a crypto research desk that shows its work. If a wrong number bothers you more than a missing one, we'd like to meet you." />
        <CareersView />
      </div>
    </SiteShell>
  );
}
