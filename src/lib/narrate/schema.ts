import { z } from "zod";

/**
 * Structured narration output. The model returns CLAIMS, not free prose, so
 * labeling (measured / mechanical / conjecture) and numeric verification are
 * mechanical rather than a matter of trusting the wording. Every number carries
 * an optional store `ref`; the ClaimVerifier resolves it before release.
 */
export const claimSchema = z.object({
  text: z.string().min(1),
  basis: z.enum(["measured", "mechanical", "conjecture"]),
  refs: z.array(z.string()).default([]),
  numbers: z
    .array(z.object({ value: z.number(), unit: z.string().optional(), ref: z.string().optional() }))
    .default([]),
});

export const briefSchema = z.object({
  headline: z.string().optional(),
  claims: z.array(claimSchema).default([]),
});

export type Claim = z.infer<typeof claimSchema>;
export type GeneratedBrief = z.infer<typeof briefSchema>;

/** JSON schema for the model's output_config.format (structured outputs). */
export const briefJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          basis: { type: "string", enum: ["measured", "mechanical", "conjecture"] },
          refs: { type: "array", items: { type: "string" } },
          numbers: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { value: { type: "number" }, unit: { type: "string" }, ref: { type: "string" } },
              required: ["value"],
            },
          },
        },
        required: ["text", "basis", "refs", "numbers"],
      },
    },
  },
  required: ["claims"],
} as const;
