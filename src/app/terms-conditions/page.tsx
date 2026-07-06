import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { LegalDoc } from "@/components/site/PageHead";

export const metadata: Metadata = {
  title: "Terms & Conditions — LensAI",
  description: "The contractual terms governing accounts, payments and liability on LensAI.",
};

const SECTIONS = [
  { h: "The agreement", p: [
    "These Terms & Conditions form the contract between you and LensAI for your use of the service, alongside our Terms of Use and Privacy Policy.",
  ] },
  { h: "Accounts", p: [
    "Your account is your connected wallet. You are responsible for all activity under it. Signing the login message proves control of the address; it authorizes a session only, never a transaction.",
    "The first two analyses per wallet are free. Further use may require credits or a paid tier.",
  ] },
  { h: "Payments & credits", p: [
    "Where paid features exist, prices are shown before purchase. Credits and subscriptions are consumed as described at the point of sale. Blockchain and network fees, where applicable, are your responsibility.",
    "Except where required by law, payments for consumed usage are non-refundable.",
  ] },
  { h: "Limitation of liability", p: [
    "To the maximum extent permitted by law, LensAI is not liable for any trading losses, indirect or consequential damages, or losses arising from reliance on the information provided.",
    "Nothing in these terms excludes liability that cannot be excluded under applicable law.",
  ] },
  { h: "Termination", p: [
    "You may delete your account at any time. We may suspend or terminate access for breach of these terms or unlawful use.",
  ] },
  { h: "Governing law", p: [
    "These terms are governed by the laws of the jurisdiction in which LensAI is established, without regard to conflict-of-law rules.",
  ] },
];

export default function TermsConditions() {
  return (
    <SiteShell>
      <LegalDoc
        index="L3" kicker="Terms & Conditions" title="The fine print, in plain words."
        updated="6 July 2026"
        intro="The contractual terms for accounts, payments and liability. Written to be read, not buried."
        sections={SECTIONS}
      />
    </SiteShell>
  );
}
