import type { Metadata } from "next";
import { JetBrains_Mono, Bricolage_Grotesque } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Providers } from "./providers";

// Type system: Bricolage Grotesque (a characterful display grotesk, ink-trapped)
// for headlines, Geist for UI/body, JetBrains Mono for data. No serif.
const jbmono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: "LensAI — Crypto Token Analysis",
  description:
    "AI-powered, decision-grade crypto token analysis from live market data and current news. Information, not financial advice.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${jbmono.variable} ${bricolage.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
