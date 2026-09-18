import { SiteShell } from "@/components/site/SiteShell";
import { Hero } from "@/components/landing/Hero";
import { Join } from "@/components/landing/Join";
import { Team } from "@/components/landing/Team";
import { Access, AgentsIndex, Close, Method, Stance } from "@/components/landing/Sections";
import "./landing.css";
import "./home.css";

/**
 * The landing page. Each section demonstrates one true thing about the desk:
 *   hero    a brief being filed, with the claim that failed verification struck out
 *   01      the curated mechanism graph, drawn exactly as it is seeded
 *   02      the pipeline, in order — the model appears only at step five
 *   03      the agents (a typed index into /agents)
 *   04      what the non-advisory filter will never let through
 *   05      identity and data
 *   06      the people who run the desk (renders only once src/lib/site/team.ts is filled)
 * Anything that looks like data and is not a live read is labeled a specimen.
 */
export default function Landing() {
  return (
    <SiteShell>
      <Hero />
      <Join />
      <Method />
      <AgentsIndex />
      <Stance />
      <Access />
      <Team />
      <Close />
    </SiteShell>
  );
}
