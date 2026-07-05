import type { Metadata } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// Brand type system (see brand/foundation.html): editorial serif display +
// data-legible UI sans + data mono.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  style: ["normal", "italic"],
});
const jbmono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "LensAI — Crypto Token Analysis",
  description:
    "AI-powered, decision-grade crypto token analysis from live market data and current news. Information, not financial advice.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} ${jbmono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
