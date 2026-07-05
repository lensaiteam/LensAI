import type { Config } from "tailwindcss";

/**
 * Design tokens ported verbatim from the prototype's app.html (:root) so the
 * rebuilt app is visually identical to the approved design. Do not invent new
 * shades — extend this palette instead.
 */
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#07070f",
        bg2: "#0b0b18",
        bg3: "#0f0f20",
        panel: "#13131f",
        card: "#181828",
        card2: "#1d1d30",
        gold: "#c8a84b",
        gold2: "#e8c96a",
        gold3: "#f5d97a",
        green: "#22c55e",
        red: "#ef4444",
        orange: "#f59e0b",
        cyan: "#06b6d4",
        purple: "#a78bfa",
        // Text ramp
        w: "#eef0ff",
        w2: "#9999b5",
        m: "#555570",
        dim: "#252538",
      },
      borderColor: {
        DEFAULT: "rgba(255,255,255,0.07)",
        strong: "rgba(255,255,255,0.13)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "-apple-system", "sans-serif"],
      },
      maxWidth: {
        content: "1100px",
      },
    },
  },
  plugins: [],
};

export default config;
