/**
 * INVARIANT 3 — non-advisory by construction. Nothing the system emits may tell a
 * user what to do: no buy/sell imperatives, no "you should", no price targets, no
 * allocations. Narration is Phase 6, but this filter + its red-team suite exist
 * now and run in CI from day one so the rule can never regress silently.
 *
 * Design bias: catch the SYSTEM's own advisory voice while leaving analytical
 * language intact ("buying pressure", "sell-side depth", "the yield reached 4.5%").
 * Rules therefore match advisory CONSTRUCTIONS, not bare finance words. This is a
 * last-resort net; attribution/uncertainty are handled upstream in narration.
 */

export interface Violation {
  rule: string;
  match: string;
  index: number;
}

export interface FilterResult {
  ok: boolean;
  violations: Violation[];
}

const RULES: { rule: string; re: RegExp }[] = [
  // Imperative trades: verb + an imperative object (now / the dip / it / your …).
  { rule: "imperative-trade", re: /\b(buy|sell|short|dump|accumulate|hodl|ape)\s+(now|today|tonight|the dip|before|it|this|them|your|my|some|more)\b/i },
  // Verb + an UPPERCASE ticker ("buy BTC", "Sell ETH"). Case-SENSITIVE on purpose:
  // the i-flag version wrongly matched any lowercase word ("short perp", "buy spot").
  { rule: "imperative-trade-ticker", re: /\b([Bb]uy|[Ss]ell|[Ss]hort|[Dd]ump|[Aa]ccumulate)\s+\$?[A-Z]{2,6}\b/ },
  // Direct instruction to the reader.
  { rule: "you-should", re: /\byou\s+(should|shouldn'?t|ought to|need to|must|gotta)\s+\w+/i },
  { rule: "should-you", re: /\bshould you\s+(buy|sell|hold|invest|accumulate|short)\b/i },
  // The system recommending action.
  { rule: "advice-verb", re: /\b(we|i|our team|lensai)\s+(recommend|suggest|advise|urge)\b/i },
  { rule: "recommend-trade", re: /\b(recommend|suggest|advise)\s+(buying|selling|shorting|accumulating|to buy|to sell|to short|a buy|a sell)\b/i },
  // Price targets.
  { rule: "price-target", re: /\b(price target|target price)\b/i },
  { rule: "target-number", re: /\b(target|targets|targeting)\s+(of\s+)?\$?\s?\d[\d,.]*/i },
  { rule: "number-target", re: /\$\s?\d[\d,.]*\s?(k|m|b|bn)?\s+(price\s+)?target/i },
  { rule: "will-reach-price", re: /\b(will|going to|gonna|expected to|set to|poised to|about to)\s+(hit|reach|test|touch|break|surpass|top)\s+\$?\s?\d/i },
  // Allocations / position sizing.
  { rule: "allocate-pct", re: /\b(allocate|put|invest)\s+\d{1,3}\s?%/i },
  { rule: "portfolio-share", re: /\b\d{1,3}\s?%\s+(of\s+)?(your|the)?\s*(portfolio|holdings|position|allocation)\b/i },
  { rule: "your-portfolio", re: /\byour\s+(portfolio|holdings|bag|bags|position|stack)\b/i },
  { rule: "position-size", re: /\bposition siz(e|ing)\b/i },
];

/** Scan text for advisory language. `ok:true` means nothing was found. */
export function checkNonAdvisory(text: string): FilterResult {
  const violations: Violation[] = [];
  for (const { rule, re } of RULES) {
    const m = re.exec(text);
    if (m) violations.push({ rule, match: m[0], index: m.index });
  }
  return { ok: violations.length === 0, violations };
}

/** Throw if the text contains advisory language (for use before any release). */
export function assertNonAdvisory(text: string): void {
  const res = checkNonAdvisory(text);
  if (!res.ok) {
    const detail = res.violations.map((v) => `${v.rule}("${v.match.trim()}")`).join(", ");
    throw new Error(`Non-advisory guardrail violated: ${detail}`);
  }
}
