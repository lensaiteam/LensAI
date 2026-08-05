import Anthropic from "@anthropic-ai/sdk";
import { briefJsonSchema } from "./schema";
import type { LlmProvider, NarrateRequest } from "./provider";

/**
 * Anthropic narration provider. Uses Claude (default claude-opus-5) with a
 * structured-output JSON schema so the model returns the CLAIMS object directly;
 * the orchestrator still zod-validates and verifies every claim, so this layer is
 * intentionally thin. Returns `unknown` — malformed output fails closed upstream.
 *
 * Provider-neutral seam: this is the only file that imports the Anthropic SDK.
 * The engine reads ANTHROPIC_API_KEY from the environment (or an `ant` profile).
 */
export class AnthropicProvider implements LlmProvider {
  name = "anthropic";
  private client: Anthropic;
  constructor(private model: string = process.env.NARRATE_MODEL ?? "claude-opus-5") {
    this.client = new Anthropic();
  }

  async generate(req: NarrateRequest): Promise<unknown> {
    // output_config.format is the structured-output surface; cast because the
    // installed SDK typings may lag the field. The response text IS the JSON.
    const params = {
      model: this.model,
      max_tokens: 16000,
      system: req.system,
      messages: [{ role: "user", content: req.context }],
      output_config: { format: { type: "json_schema", schema: briefJsonSchema } },
    } as unknown as Anthropic.MessageCreateParamsNonStreaming;

    const msg = await this.client.messages.create(params);

    if (msg.stop_reason === "refusal") {
      throw new Error("narration refused by safety classifier (fail-closed)");
    }
    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("narration produced no JSON object");
    return JSON.parse(match[0]) as unknown;
  }
}

/** Default provider for the narrate script (Anthropic; env-configured). */
export function defaultProvider(): LlmProvider {
  return new AnthropicProvider();
}
