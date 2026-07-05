import type { Config } from "tailwindcss";

/**
 * Brand theme — "private intelligence terminal" (see brand/foundation.html).
 * Colors map to the CSS custom properties in globals.css so tokens stay single-
 * sourced and theme-aware.
 */
const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        void: "var(--void)",
        ink: {
          1: "var(--ink-1)",
          2: "var(--ink-2)",
          3: "var(--ink-3)",
        },
        line: { DEFAULT: "var(--line)", strong: "var(--line-2)" },
        gold: {
          DEFAULT: "var(--gold)",
          d: "var(--gold-d)",
          l: "var(--gold-l)",
          h: "var(--gold-h)",
        },
        aqua: "var(--aqua)",
        iris: "var(--iris)",
        pos: "var(--pos)",
        neg: "var(--neg)",
        warn: "var(--warn)",
        txt: "var(--txt)",
        sec: "var(--sec)",
        mut: "var(--mut)",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Iowan Old Style", "Palatino", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      maxWidth: { content: "1180px" },
      transitionTimingFunction: { brand: "cubic-bezier(0.16,1,0.3,1)" },
      boxShadow: {
        gold: "0 12px 32px -12px var(--glow-gold)",
        "gold-lg": "0 18px 44px -12px var(--glow-gold)",
      },
    },
  },
  plugins: [],
};

export default config;
