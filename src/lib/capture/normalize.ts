/**
 * Text normalization for the immutable corpus.
 *
 * The article content hash is sha256 over the OUTPUT of `normalizeText`, so this
 * logic is part of the corpus's identity: changing it changes every future hash
 * and triggers a one-time re-dedupe event (identical articles would be re-stored
 * once under new hashes). Treat `NORMALIZER_VERSION` as a pinned dependency —
 * bump it deliberately and note the re-dedupe in the changelog. (We hand-roll
 * extraction rather than pull an HTML-extraction lib precisely so there is no
 * external version that can shift hashes out from under us.)
 */
export const NORMALIZER_VERSION = 1;

// Minimal named-entity set; numeric entities are handled generically below.
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  hellip: "…", mdash: "—", ndash: "–", copy: "©", reg: "®", trade: "™",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“",
};

/** Decode HTML entities in a single left-to-right pass (not recursive). */
function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (m, ent: string) => {
    if (ent[0] === "#") {
      const cp =
        ent[1] === "x" || ent[1] === "X"
          ? parseInt(ent.slice(2), 16)
          : parseInt(ent.slice(1), 10);
      return Number.isFinite(cp) && cp > 0 ? safeFromCodePoint(cp, m) : m;
    }
    return NAMED_ENTITIES[ent] ?? NAMED_ENTITIES[ent.toLowerCase()] ?? m;
  });
}

function safeFromCodePoint(cp: number, fallback: string): string {
  try {
    return String.fromCodePoint(cp);
  } catch {
    return fallback;
  }
}

/** Remove comments, script/style blocks, and all tags, leaving spaces. */
export function stripHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

/**
 * Deterministic, idempotent (on realistic input) text normalization:
 * strip HTML → decode entities → Unicode NFKC → collapse whitespace → trim.
 */
export function normalizeText(input: string): string {
  if (!input) return "";
  let s = stripHtml(input);
  s = decodeEntities(s);
  s = s.normalize("NFKC");
  s = s.replace(/\s+/g, " ").trim();
  return s;
}
