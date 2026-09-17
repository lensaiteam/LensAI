import { loadLocalEnv } from "./_bootstrap";
import { availableProviders, loadPool } from "../src/lib/agent/llm/pool";
import { PooledLlm } from "../src/lib/agent/llm/router";
import { runAdmission } from "../src/lib/agent/llm/admission";

/**
 * Admission eval for the free LLM pool — runs the fixed cases against EACH
 * configured provider in isolation and prints a pass table.
 *   llm:eval              every provider that has a key
 *   llm:eval groq gemini  only these
 * Costs ~6 requests per provider from its free quota. Exit code 1 if any
 * provider fails a case (disable it in config/llm-pool.json or swap its model).
 */
async function main(): Promise<void> {
  loadLocalEnv();
  const only = process.argv.slice(2);
  const pool = loadPool();
  const providers = availableProviders(pool).filter((p) => !only.length || only.includes(p.id));
  if (!providers.length) {
    console.log("No provider has a key set. See KEYS_NEEDED.md (free LLM pool).");
    process.exit(2);
  }

  let failed = false;
  for (const p of providers) {
    console.log(`\n${p.id}  (strong: ${p.models.strong} · small: ${p.models.small})`);
    const results = await runAdmission(new PooledLlm({ pool: { providers: [p] }, benchOnError: false }));
    for (const r of results) {
      console.log(`  ${r.pass ? "PASS" : "FAIL"}  ${r.name}${r.pass ? "" : `  — ${r.detail}`}`);
      if (!r.pass) failed = true;
    }
  }
  // exitCode (not exit()): lets open sockets drain — avoids a libuv assertion on Windows.
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
