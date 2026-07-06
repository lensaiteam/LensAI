import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { LegalDoc } from "@/components/site/PageHead";

export const metadata: Metadata = {
  title: "Terms of Use — LensAI",
  description: "The rules for using LensAI: informational only, not financial advice.",
};

const SECTIONS = [
  { h: "Acceptance", p: [
    "By accessing LensAI you agree to these Terms of Use. If you do not agree, do not use the service.",
  ] },
  { h: "Not financial advice", p: [
    "LensAI provides information and analysis only. It does not recommend buying or selling any asset, does not give price targets or allocations, and is not investment, legal or tax advice.",
    "Crypto assets are highly volatile and you can lose money. All decisions are your own, made at your own risk. Do your own research.",
  ] },
  { h: "Acceptable use", p: [
    "You agree not to abuse the service: no automated scraping beyond published limits, no attempts to bypass rate limits or the free tier, and no use that violates applicable law.",
    "You are responsible for the wallet you connect and for keeping its keys secure. We never ask for private keys or seed phrases.",
  ] },
  { h: "Availability & accuracy", p: [
    "Data is gathered from third-party sources in real time and may be delayed, incomplete or wrong. We surface uncertainty where we can, but make no warranty as to accuracy or availability.",
    "The service is provided \"as is\" without warranties of any kind, to the extent permitted by law.",
  ] },
  { h: "Changes", p: [
    "We may update these terms. Continued use after an update constitutes acceptance of the revised terms.",
  ] },
];

export default function TermsOfUse() {
  return (
    <SiteShell>
      <LegalDoc
        index="L2" kicker="Terms of Use" title="Information, not advice."
        updated="6 July 2026"
        intro="LensAI is a research tool. These terms make the boundary explicit: we inform, we never advise, and the decisions are yours."
        sections={SECTIONS}
      />
    </SiteShell>
  );
}
