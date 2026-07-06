import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { LegalDoc } from "@/components/site/PageHead";

export const metadata: Metadata = {
  title: "Terms & Conditions — LensAI",
  description: "The contractual terms governing accounts, payments and liability on LensAI.",
};

const SECTIONS = [
  { h: "Definitions", p: [
    "\"Service\" means the LensAI website and application. \"You\" means the person accessing the Service via a connected wallet. \"Content\" means the data, analyses and materials made available through the Service. \"$LENS\" refers to the planned utility token described on our Tokenomics page.",
  ] },
  { h: "The agreement", p: [
    "These Terms & Conditions form a binding contract between you and LensAI, together with our Terms of Use and Privacy Policy, which are incorporated by reference. If there is a conflict, the more specific provision applies to the subject in question.",
  ] },
  { h: "Accounts", p: [
    "Your account is your connected wallet. Signing the login message proves control of the address and authorizes a session only, never a transaction. You are responsible for all activity conducted under your wallet and for keeping your keys secure.",
    "You must not use another person's wallet without authorization, or attempt to create multiple identities to circumvent the free tier or any limit.",
  ] },
  { h: "Free tier, credits & payments", p: [
    "The first analyses per wallet are provided free of charge, as described in the Service. Beyond that, use may require credits or a paid plan.",
    "Where paid features exist, prices and what they include are shown before purchase. Credits and subscriptions are consumed as described at the point of sale. Any blockchain or network fees are your responsibility.",
  ] },
  { h: "Refunds", p: [
    "Except where required by law, payments for usage already consumed are non-refundable. If you believe you were charged in error, contact billing@lensai.app and we will review in good faith.",
  ] },
  { h: "Prohibited conduct", p: [
    "You agree not to misuse the Service, including by: automated scraping beyond published limits; circumventing rate limits, the free tier or security controls; probing or attacking the infrastructure; uploading malicious content; or using the Service to violate any law or the rights of others.",
  ] },
  { h: "Intellectual property & license", p: [
    "LensAI owns the Service and its software, design and brand. We grant you a limited, revocable, non-transferable license to use the Service and its output for your own research. All rights not expressly granted are reserved.",
  ] },
  { h: "Third-party services", p: [
    "The Service depends on third-party data, news and model providers. Their content and availability are outside our control, may be delayed or inaccurate, and are subject to their own terms. We are not liable for third-party services.",
  ] },
  { h: "No warranties", p: [
    "The Service and Content are provided \"as is\" and \"as available\" without warranties of any kind, to the fullest extent permitted by law. We do not warrant that the Service will be accurate, uninterrupted, secure or error-free.",
  ] },
  { h: "Limitation of liability", p: [
    "To the maximum extent permitted by law, LensAI will not be liable for any trading or investment losses, or for any indirect, incidental, special, punitive or consequential damages, arising from your use of or reliance on the Service.",
    "Where liability cannot be excluded, it is limited to the amount you paid us, if any, in the twelve months before the event giving rise to the claim.",
  ] },
  { h: "Indemnification", p: [
    "You agree to indemnify, defend and hold harmless LensAI and its team from any claims, damages, liabilities and expenses (including reasonable legal fees) arising from your use of the Service, your Content, or your breach of these terms.",
  ] },
  { h: "Termination", p: [
    "You may stop using the Service and delete your account at any time. We may suspend or terminate your access for breach of these terms, suspected abuse, or where required by law. Provisions that by their nature should survive termination will survive.",
  ] },
  { h: "Dispute resolution", p: [
    "The parties will first attempt to resolve any dispute informally by contacting legal@lensai.app. If a dispute cannot be resolved informally, it will be handled in accordance with the governing law and venue below, subject to any mandatory rights you have as a consumer.",
  ] },
  { h: "Governing law", p: [
    "These terms are governed by the laws of the jurisdiction in which LensAI is established, without regard to conflict-of-law rules, and subject to any mandatory consumer protections in your place of residence.",
  ] },
  { h: "Changes", p: [
    "We may update these terms as the Service evolves or the law changes. Material changes will be reflected by updating the date at the top of this page. Continued use after an update constitutes acceptance of the revised terms.",
  ] },
  { h: "Severability & entire agreement", p: [
    "If any provision is found unenforceable, the remaining provisions stay in effect. These terms, together with the Terms of Use and Privacy Policy, are the entire agreement between you and LensAI regarding the Service.",
  ] },
  { h: "Contact", p: [
    "Questions about these terms can be sent to legal@lensai.app.",
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
