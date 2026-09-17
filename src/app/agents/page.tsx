import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHead } from "@/components/site/PageHead";
import { AgentExplorer } from "@/components/site/AgentExplorer";
import { AGENTS } from "@/lib/site/agents";

export const metadata: Metadata = {
  title: "Agents — LensAI",
  description: "The agents on the LensAI research desk: what each one reads, how it answers, what it costs in model calls, and what it will not do.",
};

export default function Agents() {
  return (
    <SiteShell>
      <div className="subpage lp-wrap">
        <PageHead
          index="01"
          kicker="Agents"
          title="Nine agents. One desk."
          sub={`Each agent is a way of reaching what the engine has already measured. They share one rule: every connection is measured, mechanical, or labeled conjecture — and none of them will tell you what to do. ${["None", "One", "Two", "Three", "Four", "Five", "Six"][AGENTS.filter((a) => a.calls.value === "0").length]} of the nine cost no model call per question.`}
        />
        <AgentExplorer />
      </div>
    </SiteShell>
  );
}
