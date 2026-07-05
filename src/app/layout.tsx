import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Providers } from "./providers";

// Type system: a single refined grotesk (Geist, via Vercel's official package)
// for display + UI, JetBrains Mono for data. No serif — clean and restrained.
const jbmono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "LensAI — Crypto Token Analysis",
  description:
    "AI-powered, decision-grade crypto token analysis from live market data and current news. Information, not financial advice.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${jbmono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
