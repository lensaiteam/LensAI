import { describe, it, expect } from "vitest";
import { checkNonAdvisory, assertNonAdvisory } from "@/lib/guardrails/outputFilter";

// INVARIANT 3 red-team suite. Left column MUST be caught; right column MUST pass.
// Runs in CI from day one even though narration is Phase 6.

const ADVISORY = [
  "You should buy Bitcoin now.",
  "We recommend accumulating ETH here.",
  "Our price target is $120,000.",
  "BTC price target: $95k.",
  "Sell your BTC before the halving.",
  "Allocate 20% of your portfolio to SOL.",
  "Put 10% into ETH.",
  "BTC is going to hit $100,000.",
  "Should you buy the dip?",
  "I suggest shorting the market.",
  "This should be 30% of your holdings.",
  "Consider your position sizing carefully.",
  "Buy SOL now.",
  "The target of $4,500 is within reach.",
];

const ANALYTICAL = [
  "Funding sits in its 92nd percentile while spot volume fell.",
  "Buying pressure outpaced sell-side depth this week.",
  "This is a leverage-led move; the structure looks fragile.",
  "Short interest rose and the basis widened to 12%.",
  "The 10-year yield reached 4.5% and the dollar firmed.",
  "Open interest climbed as ETF inflows stalled.",
  "Stablecoin float grew by $2.1B over the month.",
  "None of this is financial advice.",
  "Depth thinned near the highs, raising gap risk.",
  "Sellers dominated the order book at the 68k level.",
];

describe("INVARIANT 3 — non-advisory guardrail (red team)", () => {
  it.each(ADVISORY)("flags advisory: %s", (line) => {
    const res = checkNonAdvisory(line);
    expect(res.ok, `expected a violation in: ${line}`).toBe(false);
    expect(res.violations.length).toBeGreaterThan(0);
    expect(() => assertNonAdvisory(line)).toThrow(/guardrail/);
  });

  it.each(ANALYTICAL)("allows analytical: %s", (line) => {
    const res = checkNonAdvisory(line);
    expect(res.ok, `false positive on: ${line} -> ${JSON.stringify(res.violations)}`).toBe(true);
  });

  it("assertNonAdvisory passes clean text and names the rule on failure", () => {
    expect(() => assertNonAdvisory("Funding is elevated versus its own history.")).not.toThrow();
    expect(() => assertNonAdvisory("You should buy now.")).toThrow(/you-should|imperative-trade/);
  });
});
