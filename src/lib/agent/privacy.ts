/**
 * The prompt privacy boundary (agent phase decision). Prompts leave our
 * infrastructure and providers may retain them, so NO user identifier may ever reach a provider: not the wallet, not an
 * email, not a Telegram id. Two layers:
 *   - scrubIdentifiers(): applied to user-supplied text (questions, pasted claims)
 *     before it is placed in a prompt — identifiers become neutral placeholders.
 *   - assertPromptClean(): the fail-closed gate inside the LLM router — a prompt
 *     that still carries an identifier is REFUSED, never sent.
 */

const PATTERNS: { label: string; re: RegExp }[] = [
  { label: "[address]", re: /\b0x[a-fA-F0-9]{40}\b/g },
  { label: "[email]", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { label: "[ens]", re: /\b[a-z0-9-]{3,}\.eth\b/gi },
  { label: "[handle]", re: /(?<![\w/])@[A-Za-z0-9_]{4,32}\b/g },
];

export function scrubIdentifiers(text: string): string {
  let out = text;
  for (const { label, re } of PATTERNS) out = out.replace(re, label);
  return out;
}

export class PromptPrivacyError extends Error {
  constructor(what: string) {
    super(`prompt privacy gate: ${what} present in an outbound prompt (refused)`);
    this.name = "PromptPrivacyError";
  }
}

/** Throw if an outbound prompt carries a wallet/email, or any listed identifier. */
export function assertPromptClean(prompt: string, forbidden: string[] = []): void {
  if (/\b0x[a-fA-F0-9]{40}\b/.test(prompt)) throw new PromptPrivacyError("a wallet address");
  if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(prompt)) throw new PromptPrivacyError("an email address");
  const lower = prompt.toLowerCase();
  for (const id of forbidden) {
    if (id && id.length >= 4 && lower.includes(id.toLowerCase())) throw new PromptPrivacyError("a user identifier");
  }
}
