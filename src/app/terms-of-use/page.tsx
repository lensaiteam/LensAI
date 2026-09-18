import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { LegalDoc } from "@/components/site/PageHead";

export const metadata: Metadata = {
  title: "Terms of Use · LensAI",
  description: "The rules for using LensAI: informational only, not financial advice.",
};

const SECTIONS = [
  { h: "Acceptance", p: [
    "These Terms of Use govern your access to and use of the LensAI website and application (the \"Service\"). By accessing or using the Service, you agree to these terms. If you do not agree, do not use the Service.",
  ] },
  { h: "Eligibility", p: [
    "You must be of legal age in your jurisdiction and legally permitted to use the Service. You are responsible for ensuring that your use complies with the laws that apply to you, including any restrictions on accessing crypto-related services in your location.",
  ] },
  { h: "The service", p: [
    "LensAI is a research tool. It gathers live market data and current news for a crypto asset and produces an analysis intended to help you form your own view.",
    "The Service assesses whether current signals look positive, mixed or negative, and presents both the bullish and bearish case. It does not tell you what to do.",
  ] },
  { h: "Not financial advice", p: [
    "The Service provides information and analysis only. It is not investment, financial, legal, accounting or tax advice, and it is not a recommendation to buy, sell or hold any asset. It does not provide price targets or allocations.",
    "Crypto assets are highly volatile and you can lose some or all of your money. Any decision you make is your own, taken at your own risk. Do your own research and consider seeking advice from a licensed professional.",
  ] },
  { h: "License to use", p: [
    "Subject to these terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your own personal, non-commercial research.",
    "You may not resell, redistribute or commercially exploit the Service or its output without our written permission.",
  ] },
  { h: "Acceptable use", p: [
    "You agree not to: scrape or automate access beyond published limits; attempt to bypass rate limits, the free tier, or any security measure; interfere with or disrupt the Service; reverse engineer non-public parts of it; or use it for any unlawful purpose.",
    "You are responsible for the wallet you connect and for keeping its keys and seed phrase secure. We will never ask for your private keys or seed phrase.",
  ] },
  { h: "Accounts", p: [
    "Your account is your connected wallet, and signing the login message authorizes a session only, never a transaction. You are responsible for all activity conducted through your wallet on the Service.",
  ] },
  { h: "Third-party data & content", p: [
    "The Service relies on third-party sources for market data and news. That content is provided by others, may be delayed, incomplete or inaccurate, and is attributed where surfaced. We do not endorse and are not responsible for third-party content.",
  ] },
  { h: "Intellectual property", p: [
    "The Service, including its software, design, and branding, is owned by LensAI and protected by intellectual-property laws. These terms do not transfer any ownership to you.",
    "Analysis output is generated for your use; underlying source facts remain the property of their respective sources.",
  ] },
  { h: "Disclaimers", p: [
    "The Service is provided \"as is\" and \"as available\", without warranties of any kind, express or implied, including fitness for a particular purpose, accuracy, or uninterrupted availability, to the fullest extent permitted by law.",
  ] },
  { h: "Limitation of liability", p: [
    "To the maximum extent permitted by law, LensAI and its team will not be liable for any trading or investment losses, or for any indirect, incidental, special or consequential damages, arising from your use of or reliance on the Service.",
    "Nothing in these terms excludes liability that cannot be excluded under applicable law.",
  ] },
  { h: "Indemnification", p: [
    "You agree to indemnify and hold harmless LensAI from any claims, losses or expenses arising out of your misuse of the Service or your breach of these terms.",
  ] },
  { h: "Suspension & termination", p: [
    "We may suspend or terminate access to the Service, in whole or in part, for breach of these terms, suspected abuse, or where required by law. You may stop using the Service at any time and delete your account from within the app.",
  ] },
  { h: "Changes", p: [
    "We may modify the Service or these terms. Material changes to the terms will be reflected by updating the date at the top of this page. Continued use after an update constitutes acceptance of the revised terms.",
  ] },
  { h: "Governing law", p: [
    "These terms are governed by the laws of the jurisdiction in which LensAI is established, without regard to conflict-of-law rules, and subject to any mandatory consumer protections that apply where you live.",
  ] },
  { h: "Contact", p: [
    "Questions about these terms can be sent to legal@lensai.app.",
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
