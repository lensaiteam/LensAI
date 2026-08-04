import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateSeraTools } from "../src/lib/tools/seraAdapter";

// Emit the drop-in Python tool modules for a SERA checkout (see docs/SERA-INTEGRATION.md).
const outDir = resolve(dirname(fileURLToPath(import.meta.url)), "../integrations/sera/tools");
mkdirSync(outDir, { recursive: true });
const files = generateSeraTools();
for (const f of files) writeFileSync(resolve(outDir, f.path), f.content);
console.log(`generated ${files.length} SERA tool modules -> integrations/sera/tools/`);
for (const f of files) console.log(`  ${f.path}`);
