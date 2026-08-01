import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Capture-layer tests run under Node (no jsdom). DB tests use in-memory SQLite,
// so the whole suite needs zero infra and runs in CI unchanged.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // Corpus/DB tests open real SQLite handles; keep them serial-friendly.
    pool: "threads",
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
