import type { AnalysisTrailer, Signal } from "../types";

/**
 * Provider-neutral trailer protocol. The model emits the 6-section prose, then
 * the sentinel, then a JSON block with the structured fields (§5.4). Both the
 * analyze and pre-compute paths parse it the same way, regardless of provider.
 */

// Separates the streamed prose from the machine-readable trailer. The client
// stops rendering at this marker; the server parses the JSON after it.
export const TRAILER_SENTINEL = "<<<LENSAI_DATA>>>";

/** Split model output into display prose and the parsed JSON trailer. */
export function splitTrailer(fullText: string): { prose: string; trailer: AnalysisTrailer | null } {
  const idx = fullText.indexOf(TRAILER_SENTINEL);
  if (idx === -1) return { prose: fullText.trim(), trailer: null };

  const prose = fullText.slice(0, idx).trim();
  const after = fullText.slice(idx + TRAILER_SENTINEL.length);

  // Extract the JSON from a fenced ```json block, or the first {...} object.
  const fenced = after.match(/```json\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : (after.match(/\{[\s\S]*\}/)?.[0] ?? "");
  if (!raw.trim()) return { prose, trailer: null };

  try {
    return { prose, trailer: JSON.parse(raw) as AnalysisTrailer };
  } catch {
    return { prose, trailer: null };
  }
}

/** Fallback signal detection if the trailer is missing/unparseable. */
export function inferSignal(prose: string): Signal {
  const m = prose.match(/Signal:\s*\**\s*(POSITIVE|MIXED|NEGATIVE)/i);
  if (m) return m[1].toUpperCase() as Signal;
  return "MIXED";
}
