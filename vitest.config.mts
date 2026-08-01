import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Capture-layer tests run under Node. DB tests use in-memory SQLite so the whole
// suite needs zero infra and runs in CI unchanged.
//
// pool: "forks" is REQUIRED: better-sqlite3 is a native addon and segfaults under
// vitest's default worker-thread pool; child processes load it safely.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    // better-sqlite3 is a native addon and segfaults when re-loaded across
    // vitest's per-test loader/isolation boundaries on Node 24. Load it once:
    // a single long-lived fork with isolation off.
    pool: "forks",
    poolOptions: { forks: { singleFork: true, isolate: false } },
    isolate: false,
  },
  // Let Node's native loader require the addon instead of Vite transforming it.
  server: { deps: { external: ["better-sqlite3"] } },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
