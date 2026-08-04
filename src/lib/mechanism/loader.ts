import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { seedSchema, type Seed } from "./schema";
import { sha256, canonicalJson } from "../capture/hash";
import { checkNonAdvisory, type Violation } from "../guardrails/outputFilter";

/**
 * Parse + validate the mechanism-graph seed. Beyond zod (shape + referential
 * integrity), the loader runs the non-advisory guardrail over EVERY prose field
 * (amendment #7) and computes a content checksum used for versioning rulings.
 */

const DEFAULT_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "../../../config/mechanism-graph.yaml");

export interface LoadedSeed {
  seed: Seed;
  /** sha256 over the substantive content (nodes + edges), NOT the version/curator,
   *  so "same content under a new version id" is detectable. */
  checksum: string;
}

/** Content checksum: version-independent so version rulings work (amendment #2/#6). */
export function contentChecksum(seed: Seed): string {
  return sha256(canonicalJson({ nodes: seed.nodes, edges: seed.edges }));
}

/** Guardrail: no advisory language in any prose field. Throws with the offenders. */
export function assertSeedNonAdvisory(seed: Seed): void {
  const hits: { where: string; violation: Violation }[] = [];
  const scan = (where: string, text: string | undefined) => {
    if (!text) return;
    for (const v of checkNonAdvisory(text).violations) hits.push({ where, violation: v });
  };
  for (const n of seed.nodes) {
    scan(`node ${n.id}.label`, n.label);
    scan(`node ${n.id}.description`, n.description);
  }
  for (const e of seed.edges) {
    scan(`edge ${e.id}.mechanism`, e.mechanism);
    scan(`edge ${e.id}.conditions`, e.conditions);
  }
  if (hits.length) {
    const detail = hits.map((h) => `${h.where}: ${h.violation.rule}("${h.violation.match.trim()}")`).join("; ");
    throw new Error(`Mechanism seed violates the non-advisory guardrail: ${detail}`);
  }
}

export function parseSeed(text: string): Seed {
  return seedSchema.parse(yaml.load(text));
}

export function loadSeedFromText(text: string): LoadedSeed {
  const seed = parseSeed(text);
  assertSeedNonAdvisory(seed);
  return { seed, checksum: contentChecksum(seed) };
}

export function loadSeedFromFile(path: string = DEFAULT_PATH): LoadedSeed {
  return loadSeedFromText(readFileSync(path, "utf8"));
}
