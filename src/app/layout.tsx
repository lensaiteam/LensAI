import type { Metadata } from "next";
import { JetBrains_Mono, Arimo } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { Providers } from "./providers";

// Type system (Bécane reference): a neutral Helvetica-like grotesque for
// display — Arimo is a Helvetica/Arial metric clone; the stack still prefers
// real Helvetica Neue where installed. Geist for UI/body, JetBrains for data.
const jbmono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
const arimo = Arimo({ subsets: ["latin"], variable: "--font-display", display: "swap", weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "LensAI — Crypto Token Analysis",
  description:
    "AI-powered, decision-grade crypto token analysis from live market data and current news. Information, not financial advice.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${jbmono.variable} ${arimo.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
