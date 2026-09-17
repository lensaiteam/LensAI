import { RateLimitedError } from "./types";

/**
 * One OpenAI-compatible chat-completions call in JSON mode. Every provider in the
 * pool (Gemini's compat endpoint, Groq, Cerebras, Mistral, OpenRouter) accepts
 * this shape, so there is exactly one client. `json_object` mode is the widest
 * common denominator; the shape is described in the prompt and zod-validated by
 * the caller. `fetchFn` is injectable for tests.
 */

export type FetchFn = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export interface CompatCall {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs?: number;
}

export interface CompatResult {
  data: unknown;
  inputTokens: number;
  outputTokens: number;
}

/** Pull the first JSON object out of a completion (models wrap it in prose/fences). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("completion contained no JSON object");
  return JSON.parse(body.slice(start, end + 1)) as unknown;
}

export async function callOpenAiCompat(call: CompatCall, fetchFn: FetchFn = fetch as unknown as FetchFn): Promise<CompatResult> {
  const res = await fetchFn(`${call.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${call.apiKey}` },
    body: JSON.stringify({
      model: call.model,
      messages: [
        { role: "system", content: call.system },
        { role: "user", content: call.user },
      ],
      response_format: { type: "json_object" },
      max_tokens: call.maxTokens,
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(call.timeoutMs ?? 45_000),
  });

  if (res.status === 429) {
    const ra = Number(res.headers.get("retry-after"));
    throw new RateLimitedError(call.providerId, Number.isFinite(ra) && ra > 0 ? ra * 1000 : 60_000);
  }
  const raw = await res.text();
  if (!res.ok) throw new Error(`${call.providerId} HTTP ${res.status}: ${raw.slice(0, 200)}`);

  const parsed = JSON.parse(raw) as {
    choices?: { message?: { content?: string | null } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = parsed.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${call.providerId} returned an empty completion`);
  return {
    data: extractJson(content),
    inputTokens: parsed.usage?.prompt_tokens ?? 0,
    outputTokens: parsed.usage?.completion_tokens ?? 0,
  };
}
