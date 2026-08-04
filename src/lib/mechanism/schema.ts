import { z } from "zod";
import { REGIME_KEYS } from "../factors/regimes";

/**
 * Zod schema + vocabularies for the mechanism-graph seed. Referential integrity
 * (unique ids, edges point at real nodes) is enforced here in a superRefine so a
 * malformed seed can never load.
 */

export const NODE_KINDS = ["factor", "concept", "instrument", "entity"] as const;
export const POLARITIES = ["positive", "negative", "conditional"] as const;
export const LIFECYCLES = ["documented", "validated", "decaying", "broken"] as const;
export const STRENGTHS = ["strong", "moderate", "weak"] as const;
export const EVIDENCE_TYPES = ["article", "claim", "external"] as const;

/** Factor streams a node may map to (must match the capture adapters' streams). */
export const KNOWN_STREAMS = [
  "funding_rate", "open_interest", "depth", "spot_price", "spot_volume",
  "stablecoin_float", "macro_dxy", "macro_rate",
] as const;

const SLUG = /^[a-z0-9_]+$/;

// A regime ref is a regime key, optionally "key:value"; the key must be known.
const regimeRef = z.string().refine((v) => REGIME_KEYS.includes(v.split(":")[0]), {
  message: `regime key must be one of: ${REGIME_KEYS.join(", ")}`,
});

const evidenceSchema = z.object({
  type: z.enum(EVIDENCE_TYPES),
  ref: z.string().min(1),
  note: z.string().optional(),
});

export const nodeSchema = z
  .object({
    id: z.string().regex(SLUG, "node id must be a lowercase slug"),
    label: z.string().min(1),
    kind: z.enum(NODE_KINDS),
    factor_stream: z.string().optional(),
    description: z.string().optional(),
    deprecated: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .superRefine((n, ctx) => {
    if (n.factor_stream && !(KNOWN_STREAMS as readonly string[]).includes(n.factor_stream)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `unknown factor_stream "${n.factor_stream}"`, path: ["factor_stream"] });
    }
    if (n.kind === "factor" && !n.factor_stream) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `factor node "${n.id}" must set factor_stream`, path: ["factor_stream"] });
    }
  });

export const edgeSchema = z.object({
  id: z.string().regex(SLUG, "edge id must be a lowercase slug"),
  src: z.string(),
  dst: z.string(),
  polarity: z.enum(POLARITIES),
  channel: z.string().optional(),
  mechanism: z.string().min(1),
  conditions: z.string().optional(),
  regimes_applies: z.array(regimeRef).optional(),
  regimes_breaks: z.array(regimeRef).optional(),
  lifecycle: z.enum(LIFECYCLES),
  strength: z.enum(STRENGTHS).optional(),
  deprecated: z.boolean().optional(),
  evidence: z.array(evidenceSchema).optional(),
});

export const seedSchema = z
  .object({
    version: z.string().regex(/^[a-z0-9_.-]+$/, "version must be a slug"),
    curator: z.string().min(1),
    note: z.string().optional(),
    nodes: z.array(nodeSchema).min(1),
    edges: z.array(edgeSchema).default([]),
  })
  .superRefine((seed, ctx) => {
    const nodeIds = new Set<string>();
    for (const n of seed.nodes) {
      if (nodeIds.has(n.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate node id: ${n.id}` });
      nodeIds.add(n.id);
    }
    const edgeIds = new Set<string>();
    for (const e of seed.edges) {
      if (edgeIds.has(e.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `duplicate edge id: ${e.id}` });
      edgeIds.add(e.id);
      if (!nodeIds.has(e.src)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `edge ${e.id}: src "${e.src}" is not a node` });
      if (!nodeIds.has(e.dst)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `edge ${e.id}: dst "${e.dst}" is not a node` });
      if (e.src === e.dst) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `edge ${e.id}: src and dst are the same node` });
    }
  });

export type SeedNode = z.infer<typeof nodeSchema>;
export type SeedEdge = z.infer<typeof edgeSchema>;
export type Seed = z.infer<typeof seedSchema>;
