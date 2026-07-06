import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { LegalDoc } from "@/components/site/PageHead";

export const metadata: Metadata = {
  title: "Privacy Policy — LensAI",
  description: "What LensAI stores, why, and how to delete it. Identity is a wallet address — no email, password or PII.",
};

const SECTIONS = [
  { h: "Overview", p: [
    "This Privacy Policy explains what information LensAI (\"we\", \"us\") collects when you use our website and application, how we use it, and the controls you have over it. LensAI is built to hold as little about you as possible.",
    "Your identity on LensAI is a public wallet address, proven by a signature. We do not run traditional accounts, and we do not ask for your name, email, password or payment identity to use the core product.",
  ] },
  { h: "Information we collect", p: [
    "Account identity: your wallet address (stored lowercased), the chain you connected, and timestamps for when the account was first seen and last used.",
    "Research data: the tickers you analyze and the sessions and chat threads you create. This is the product, and it is stored so you can return to it.",
    "Operational data: minimal technical logs such as request and token counts, model used, and whether a result was served from cache — used to run, secure and cost the service.",
  ] },
  { h: "Information we do not collect", p: [
    "We do not collect your name, email address, password, phone number or government identifiers.",
    "We do not store your on-chain balances, holdings or portfolio. If portfolio features are ever added, they are computed live from the public chain at request time and then discarded.",
    "We do not persist the raw cryptographic signature you use to log in beyond the moment it is verified.",
  ] },
  { h: "How we use information", p: [
    "To provide the service: resolving tickers, gathering data, generating analyses, and letting you reopen your own history.",
    "To scope and secure access: your wallet address is used to ensure only you can read your own sessions, and to enforce rate limits and the free tier.",
    "To operate and improve: aggregate, non-identifying usage metrics help us understand cost and reliability. We do not sell your data or use your research history to advertise to you.",
  ] },
  { h: "Cookies & local storage", p: [
    "We use a strictly necessary session cookie (or equivalent local storage) to keep you signed in after you verify your wallet signature. It is not used for advertising or cross-site tracking.",
    "We do not embed third-party advertising or analytics trackers that profile you across the web.",
  ] },
  { h: "Third-party services", p: [
    "To function, LensAI sends non-personal queries to third-party providers — market-data sources, news sources, and an AI model provider — to gather facts and generate analysis.",
    "These providers process the ticker and gathered data needed to answer a request, not your identity. We do not share your wallet address with them for the purpose of the analysis.",
  ] },
  { h: "Data retention", p: [
    "We keep your account identity and research history for as long as your account exists, so the product is useful to you. Operational logs are kept only as long as needed to run and secure the service, then reduced or removed.",
    "When you delete a session or your account, the associated data is removed as described below.",
  ] },
  { h: "Security", p: [
    "All secrets are held server-side and never exposed to your browser. Login nonces are single-use and short-lived, and signatures are verified against your address, the domain and the chain before a session is issued.",
    "No system is perfectly secure, but we minimize what we hold precisely so that a compromise would expose as little as possible.",
  ] },
  { h: "International transfers", p: [
    "Our providers may process data in countries other than yours. Where required, we rely on appropriate safeguards for such transfers. Because we hold so little personal data, the exposure from any transfer is limited by design.",
  ] },
  { h: "Your rights", p: [
    "Depending on where you live, you may have rights to access, correct, export or delete your data, and to object to or restrict certain processing.",
    "Because your identity is a wallet you control, you can exercise the most important right — deletion — yourself, at any time, from within the app.",
  ] },
  { h: "Deletion & controls", p: [
    "You can delete any individual session, or your entire account, at any time. Account deletion removes your sessions, messages, watchlist and free-tier records.",
    "Disconnecting your wallet ends the current session immediately. To make additional requests, contact us at privacy@lensai.app.",
  ] },
  { h: "Children", p: [
    "LensAI is not directed to children and is not intended for anyone under the age of majority in their jurisdiction. We do not knowingly collect data from children.",
  ] },
  { h: "Changes to this policy", p: [
    "We may update this policy as the product evolves or the law changes. Material changes will be reflected by updating the date at the top of this page. Continued use after an update constitutes acceptance of the revised policy.",
  ] },
  { h: "Contact", p: [
    "Questions or requests regarding this policy can be sent to privacy@lensai.app.",
  ] },
];

export default function Privacy() {
  return (
    <SiteShell>
      <LegalDoc
        index="L1" kicker="Privacy Policy" title="Store the minimum."
        updated="6 July 2026"
        intro="LensAI is built to hold as little about you as possible. Your identity is a wallet address, proven by a signature — no email, no password, no PII. This policy explains exactly what we do and don't keep."
        sections={SECTIONS}
      />
    </SiteShell>
  );
}
