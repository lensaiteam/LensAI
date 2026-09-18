import type { Metadata } from "next";
import localFont from "next/font/local";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { MotionRoot } from "./motion";

// Type system: ONE well-drawn Swiss neo-grotesque for display + text, self-hosted so
// it renders identically on every OS (the old stack fell through to an Arial clone
// on Windows). Switzer is variable (100–900), which lets display sit at an in-between
// weight instead of a blunt bold. Geist Mono carries data and placard labels.
const switzer = localFont({
  src: [
    { path: "./fonts/Switzer-Variable.woff2", style: "normal", weight: "100 900" },
    { path: "./fonts/Switzer-VariableItalic.woff2", style: "italic", weight: "100 900" },
  ],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LensAI · The crypto research desk",
  description:
    "A crypto research desk. Ask it a question, leave it watching a condition, or hand it a claim to check. Every connection it draws is measured, mechanical, or labeled conjecture. Information, not financial advice.",
  icons: { icon: "/logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${switzer.variable} ${GeistMono.variable}`}>
      <body>
        <MotionRoot>{children}</MotionRoot>
      </body>
    </html>
  );
}
