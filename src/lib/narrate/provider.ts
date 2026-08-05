/**
 * LLM provider seam for narration. The pipeline depends only on this interface,
 * so tests inject a deterministic MockProvider (no API key) and production wires
 * the Anthropic provider (generate.ts). The provider returns UNKNOWN — the
 * orchestrator zod-validates it, so malformed/hallucinated output fails closed.
 */
export interface NarrateRequest {
  system: string;
  context: string;
}

export interface LlmProvider {
  name: string;
  generate(req: NarrateRequest): Promise<unknown>;
}

/** Deterministic provider for tests: returns whatever brief it was constructed with. */
export class MockProvider implements LlmProvider {
  name = "mock";
  constructor(private readonly brief: unknown) {}
  async generate(): Promise<unknown> {
    return this.brief;
  }
}
