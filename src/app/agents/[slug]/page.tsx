import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/site/SiteShell";
import { PageHead } from "@/components/site/PageHead";
import { AgentExplorer } from "@/components/site/AgentExplorer";
import { AGENTS, agentBySlug } from "@/lib/site/agents";

export function generateStaticParams() {
  return AGENTS.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const a = agentBySlug(params.slug);
  if (!a) return { title: "Agents — LensAI" };
  return { title: `${a.name} — LensAI agents`, description: a.line };
}

export default function Agents({ params }: { params: { slug: string } }) {
  if (!agentBySlug(params.slug)) notFound();
  return (
    <SiteShell>
      <div className="subpage lp-wrap">
        <PageHead
          index="01"
          kicker="Agents"
          title="Nine agents. One desk."
          sub={`Each agent is a way of reaching what the engine has already measured. They share one rule: every connection is measured, mechanical, or labeled conjecture — and none of them will tell you what to do. ${["None", "One", "Two", "Three", "Four", "Five", "Six"][AGENTS.filter((a) => a.calls.value === "0").length]} of the nine cost no model call per question.`}
        />
        <AgentExplorer initialSlug={params.slug} />
      </div>
    </SiteShell>
  );
}
