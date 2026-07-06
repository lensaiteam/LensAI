import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { LegalDoc } from "@/components/site/PageHead";

export const metadata: Metadata = {
  title: "Privacy Policy — LensAI",
  description: "What LensAI stores, why, and how to delete it. Identity is a wallet address — no email, password or PII.",
};

const SECTIONS = [
  { h: "What we store", p: [
    "Your account is a wallet address, stored lowercased, with a chain ID and first-seen / last-login timestamps. We do not collect email, password, name or other traditional personal information.",
    "We store your research history — the sessions and chat threads you create — because it is the product. We also keep minimal operational logs (token and request counts) to run and cost the service.",
  ] },
  { h: "What we never store", p: [
    "We do not store on-chain balances, holdings or portfolios. If portfolio features arrive, they are computed live from the public chain at request time and discarded.",
    "We do not persist raw signatures after verifying them, and we avoid storing your wallet address next to your IP address.",
  ] },
  { h: "How we use it", p: [
    "Your wallet address scopes your data so only you can read your sessions. Gathered token data (prices, news) is shared, non-personal content and is kept out of your personal records.",
    "We never sell your data or use your research history to target you.",
  ] },
  { h: "Your controls", p: [
    "You can delete any individual session, or your entire account, at any time. Account deletion removes your sessions, messages, watchlist and usage records.",
    "Because your identity is a public wallet address, disconnecting your wallet ends the session immediately.",
  ] },
  { h: "Contact", p: [
    "Questions about this policy can be sent to privacy@lensai.app.",
  ] },
];

export default function Privacy() {
  return (
    <SiteShell>
      <LegalDoc
        index="L1" kicker="Privacy Policy" title="Store the minimum."
        updated="6 July 2026"
        intro="LensAI is built to hold as little about you as possible. Your identity is a wallet address, proven by a signature — no email, no password, no PII."
        sections={SECTIONS}
      />
    </SiteShell>
  );
}
