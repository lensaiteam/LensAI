/**
 * The agent registry — the single source the marketing site reads when it talks
 * about agents (explorer, landing index, whitepaper). Every fact here mirrors the
 * engine (`src/lib/agent/`, `docs/AGENT.md`): which factor families an agent reads,
 * how many model calls it costs, which gates its output passes. Nothing is a
 * projection — if the engine changes, change it here.
 */

export const FACTORS = [
  { id: "funding", label: "Funding" },
  { id: "basis", label: "Basis / yield" },
  { id: "macro", label: "Macro" },
  { id: "flows", label: "Flows" },
  { id: "depth", label: "Depth" },
  { id: "news", label: "News" },
] as const;
export type FactorId = (typeof FACTORS)[number]["id"];

/** The answer pipeline. An agent's `path` lists the steps it actually runs. */
export const STEPS = [
  { id: "plan", label: "Plan", note: "Route the question. Heuristics first; a small model only when it is ambiguous." },
  { id: "gather", label: "Gather", note: "Read the stores point-in-time — nothing captured after the anchor can enter." },
  { id: "compute", label: "Compute", note: "Pure arithmetic over the derived tables. No model." },
  { id: "generate", label: "Generate", note: "One structured generation: atomic claims, each typed measured / mechanical / conjecture." },
  { id: "verify", label: "Verify", note: "Every number must resolve to a store row; a mechanical claim must cite a real graph edge. Failures are dropped, never softened." },
  { id: "guard", label: "Guardrail", note: "The non-advisory filter. Anything that reads as an instruction never ships." },
] as const;
export type StepId = (typeof STEPS)[number]["id"];

export const KINDS = [
  { id: "read", label: "Read", blurb: "Describe the structure of the market, or of one token inside it." },
  { id: "watch", label: "Watch", blurb: "Keep working while you are away." },
  { id: "verify", label: "Verify", blurb: "Check someone else's claim against measured data." },
  { id: "connect", label: "Connect", blurb: "Give your own agent the desk's hands." },
] as const;
export type KindId = (typeof KINDS)[number]["id"];

export interface AgentSpec {
  slug: string;
  /** Stable index shown as a placard (a real, typed index — not decoration). */
  code: string;
  name: string;
  kind: KindId;
  /** One line, for index rows. */
  line: string;
  /** The placard paragraph. */
  about: string;
  reads: FactorId[];
  path: StepId[];
  /** Model calls this costs per request, stated honestly. */
  calls: { value: string; note: string };
  output: string;
  /** Things you can say to it, verbatim. */
  asks: string[];
  /** What it will not do — the boundary is part of the product. */
  wont: string;
  /** Endpoint on the agent service (docs/AGENT.md). */
  endpoint: string;
}

const ALL: FactorId[] = ["funding", "basis", "macro", "flows", "depth", "news"];

export const AGENTS: AgentSpec[] = [
  {
    slug: "market-state",
    code: "A01",
    name: "Market State",
    kind: "read",
    line: "The whole market's structure, read across all six factor families at once.",
    about:
      "Where each factor sits against its own history, which documented relationships have broken, and the structural signature — spot-led, leverage-led or fragile. One brief is filed per hourly anchor and served to everyone, because the state of the market is the same for every reader.",
    reads: ALL,
    path: ["gather", "generate", "verify", "guard"],
    calls: { value: "0", note: "per reader — one shared brief is generated each hour" },
    output: "A filed brief: typed claims, each traceable to a store row, stamped with its as-of time.",
    asks: ["Market state", "What's the market doing?", "Is leverage leading or is spot?"],
    wont: "It describes structure. It never says what to do about it.",
    endpoint: "POST /v1/ask",
  },
  {
    slug: "token-briefing",
    code: "A02",
    name: "Token Briefing",
    kind: "read",
    line: "One token, read inside the market it is trading in.",
    about:
      "A token's funding, open interest and the rest as percentiles against its own 90-day, 365-day and full history — then placed in the market context, so a stretched reading is distinguished from a market-wide one. Compare up to three tokens in a single question.",
    reads: ["funding", "basis", "flows", "depth", "news"],
    path: ["plan", "gather", "generate", "verify", "guard"],
    calls: { value: "0–2", note: "a generic brief is shared per anchor; a specific angle costs one plan + one generation" },
    output: "A briefing of verified claims; anything the desk does not measure is said plainly, not guessed.",
    asks: ["Brief on SOL", "Is BTC funding confirmed by open interest?", "Compare ETH and SOL positioning"],
    wont: "No call, no target, no allocation — a percentile is a measurement, not a recommendation.",
    endpoint: "POST /v1/ask",
  },
  {
    slug: "incident-mechanics",
    code: "A03",
    name: "Incident Mechanics",
    kind: "read",
    line: "A post-mortem when something breaks — trigger, amplifier and mechanism held apart.",
    about:
      "Grounds on the divergence flags that fired, the candidate transmission channels in the mechanism graph, the immutable news corpus from that week and typed claims with their claimant and incentive. It never blesses a single cause; where a causal story comes from a source, it is attributed to that source.",
    reads: ALL,
    path: ["plan", "gather", "generate", "verify", "guard"],
    calls: { value: "1–2", note: "one plan (often skipped) + one generation" },
    output: "A mechanism-level account, with every causal link either documented in the graph or labeled conjecture.",
    asks: ["What broke on the 5th?", "Why did SOL funding collapse?", "What was knowable before the cascade?"],
    wont: "No hindsight: it reasons only over what had been captured at that moment.",
    endpoint: "POST /v1/ask",
  },
  {
    slug: "mechanism",
    code: "A04",
    name: "Mechanism",
    kind: "read",
    line: "How a transmission channel works, from the curated graph.",
    about:
      "Answers from the hand-curated mechanism graph: directed channels such as funding → basis trade → ETF arbitrage, each with polarity, rationale and lifecycle. Edge strength is presented as what it is — a curated prior, not a measured value.",
    reads: ["funding", "basis", "macro", "flows", "depth"],
    path: ["plan", "gather", "generate", "verify", "guard"],
    calls: { value: "1–2", note: "one plan + one generation" },
    output: "An explanation that cites graph edge ids; a channel that is not in the graph is called conjecture.",
    asks: ["How does funding feed the basis trade?", "Why would a stronger dollar matter here?"],
    wont: "It will not invent a channel the graph does not document.",
    endpoint: "POST /v1/ask",
  },
  {
    slug: "what-changed",
    code: "A05",
    name: "What Changed",
    kind: "read",
    line: "The difference between the last time you looked and now.",
    about:
      "Flags that opened or cleared, regimes that shifted, and the factors that moved furthest against their own history — computed between two anchors. The only thing it needs from you is a timestamp; the point-in-time stores do the rest.",
    reads: ALL,
    path: ["gather", "compute", "guard"],
    calls: { value: "0", note: "pure arithmetic — it cannot hallucinate" },
    output: "A dated change list, scoped to your watchlist if you keep one.",
    asks: ["What changed since I last looked?", "What changed in the last 3 days?", "Catch me up on ETH"],
    wont: "No narrative layered on top — only what measurably moved.",
    endpoint: "GET /v1/changes",
  },
  {
    slug: "watch",
    code: "A06",
    name: "Watch",
    kind: "watch",
    line: "A standing condition, in plain language, that alerts you when it becomes true.",
    about:
      "Say it once — “tell me when BTC funding is extreme but basis isn't following”. A small model translates it into a rule, the desk echoes the rule back in exact terms, and you confirm. From then on the watch is arithmetic: evaluated once per anchor, fired on the transition from false to true, bounded by a cooldown, silent on missing data.",
    reads: ["funding", "basis", "macro", "flows", "depth"],
    path: ["plan", "compute", "guard"],
    calls: { value: "1", note: "once, to compile — then zero, however many watches run" },
    output: "A Telegram or email alert carrying the measured evidence that satisfied the rule.",
    asks: ["Tell me when ETH funding is washed out", "Alert me if the fragile signature fires for BTC"],
    wont: "A watch describes a state. Price-level alerts and anything shaped like an instruction are refused.",
    endpoint: "POST /v1/watches",
  },
  {
    slug: "claim-check",
    code: "A07",
    name: "Claim Check",
    kind: "verify",
    line: "Paste a post or a thread. Get each claim checked against the desk's own data.",
    about:
      "The model only extracts the claims and maps each number to the store row that measures the same thing. The verdict is arithmetic: supported within one percent, contradicted with the store's value shown, or unverifiable because the desk does not measure it. A causal claim counts as documented only if it maps to a real edge in the mechanism graph.",
    reads: ["funding", "basis", "flows", "depth", "news"],
    path: ["gather", "generate", "verify", "guard"],
    calls: { value: "1", note: "one extraction — the judgement itself is not a model's" },
    output: "A verdict per claim with the evidence row, and the claimant where the text names one.",
    asks: ["Check this thread", "Is this funding number right?"],
    wont: "A trade instruction inside the pasted text is reported, never repeated or evaluated.",
    endpoint: "POST /v1/claim-check",
  },
  {
    slug: "the-record",
    code: "A08",
    name: "The Record",
    kind: "verify",
    line: "The desk's own track record — including the claims it had to drop.",
    about:
      "Every brief the desk files is appended to an immutable calibration record with the claims that survived verification and the ones that did not. Ask for it and you get the count, by surface, read straight from that record.",
    reads: [],
    path: ["gather", "compute"],
    calls: { value: "0", note: "read from the append-only record" },
    output: "Briefs filed, claims generated, claims that survived — dated.",
    asks: ["What's your track record?", "How often do your claims survive verification?"],
    wont: "Outcome scoring of flags is not computed yet, so it does not claim a hit rate.",
    endpoint: "POST /v1/ask",
  },
  {
    slug: "tool-endpoint",
    code: "A09",
    name: "Tool Endpoint",
    kind: "connect",
    line: "The desk's read-only tools, for an agent you already run.",
    about:
      "Seven point-in-time tools over JSON-RPC — market state, token factor state, divergences, mechanism, factor series, corpus search and typed claims. Every call takes an as-of anchor and can never return a row captured after it. Authenticate with an API key; only its hash is stored.",
    reads: ALL,
    path: ["gather"],
    calls: { value: "0", note: "data only — your agent brings its own model" },
    output: "JSON that states the anchor it resolved to and carries its provenance.",
    asks: ["tools/list", "tools/call get_market_state", "tools/call get_divergences"],
    wont: "Read-only. An API key cannot manage an account.",
    endpoint: "POST /rpc",
  },
];

export const agentBySlug = (slug: string): AgentSpec | undefined => AGENTS.find((a) => a.slug === slug);
