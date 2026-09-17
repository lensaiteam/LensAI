/**
 * DEVELOPMENT-ONLY fixture for styling the terminal without a wallet session:
 * `/app?preview=thread` or `/app?preview=empty` while `next dev` is running.
 * page.tsx only reads this when NODE_ENV === "development", so none of it is
 * reachable in a production build. The thread is a SPECIMEN — obviously fake
 * numbers, never shown to a user.
 */
export const PREVIEW_WALLET = "0x7a3f00000000000000000000000000000000c2e1";

export const PREVIEW_SNAP = {
  name: "Specimen",
  symbol: "SPEC",
  price: "$100.00",
  c24: 1.2,
  c7: -3.4,
  vol: 1_250_000_000,
  mcap: 48_000_000_000,
  circ: 480_000_000,
  rank: 7,
  spark: [50, 52, 51, 54, 53, 56, 55, 58, 57, 56, 59, 61, 60, 62],
  source: "specimen",
  unresolved: false,
};

export const PREVIEW_FLAGS = [
  { level: "green" as const, label: "Deep liquidity on major venues" },
  { level: "yellow" as const, label: "Large scheduled unlock within 90 days" },
  { level: "red" as const, label: "Validator set concentrated in few operators" },
];

export const PREVIEW_SENTIMENT = { overall: "MIXED" as const, tone: "Constructive on usage, wary on supply overhang.", sources: ["news", "social"] };

export const PREVIEW_MESSAGES = [
  { role: "user" as const, content: "Analyze SPEC" },
  {
    role: "assistant" as const,
    content: `## Snapshot
A high-throughput L1. Price and volume are specimen values for layout only.

- **Price:** $100.00, up 1.2% over 24h
- **Market cap:** $48B, rank #7

## Tokenomics
Circulating supply is 480M of a larger total, with staged unlocks.

- Inflation schedule steps down annually
- A sizeable unlock lands within the next quarter

## Recent developments
- Client upgrade shipped without downtime
- A large application migrated part of its activity on-chain

## Sentiment
Constructive on usage, wary on the supply overhang.

## Risk flags
- Validator concentration remains a structural risk
- Upcoming unlock adds supply pressure

## Overall read
Signal: **MIXED**

Usage is real and improving, while near-term supply is a headwind; both are priced into the same market at once.

**Bull case**
- Activity growth is organic rather than incentive-driven
- Upgrades have improved reliability

**Bear case**
- Unlock adds supply into thin depth
- Validator concentration is unresolved

This is an assessment of current signals, not financial advice.`,
  },
];
