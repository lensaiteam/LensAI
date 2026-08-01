# LensAI — The Research Desk

**Product specification: executive summary (v2)**

Connect the dots. Show the work.

An automated research desk for crypto: cross-factor market reads and token analysis synthesized from measured evidence — and deliberately never financial advice. This document specifies what we are building, on what, and why it holds.

---

## 01 Abstract

LensAI v2 is an automated research desk. It reads the market the way a good analyst does — funding, basis and yield, macro, institutional flows, market depth, and news, together — and produces decision-grade syntheses at two levels: the state of the market as a whole, and any single token read in that context. It runs on an open-source agent base, is grounded in a proprietary time-aligned corpus and factor store, and is constrained so that every connection it draws is measured, mechanical, or explicitly labeled as conjecture.

v1's principle was "the pipeline is the product." v2 sharpens it: **the join is the product.**

## 02 The problem

Every input a serious market read needs is sold — separately. Depth from one vendor, on-chain data from another, derivatives from a third; ETF flows in spreadsheets; macro on a terminal. The synthesis across them is produced by humans at institutional desks, weekly, for paying clients. For everyone else it effectively does not exist.

What does exist is the daily explainer — "bitcoin fell because X" — published everywhere, mostly noise dressed as insight. A language model pointed at raw feeds will generate exactly that, confidently, forever. The gap in the market is not data, and it is not narration. It is disciplined synthesis: the join, plus the discipline.

## 03 Three surfaces

**Market State.** An always-on desk brief: where each factor sits against its own history, which relationships between factors have broken, and the structural read that follows. The flagship question: is this move spot-led or leverage-led? Funding flat, basis tight, ETF inflows strong, depth stable — spot-led. Funding stretched, open interest climbing, flows flat — leverage-led, and fragile. Computable, valuable, and non-advisory: it describes the structure of a move, never what to do about it.

**Token briefings.** v1's six-section briefing survives — snapshot, tokenomics, recent developments, sentiment, risk flags, overall read — with one upgrade: every briefing is conditioned on Market State. Micro read, macro context, the way a real desk works. Resolution-first as before; an unverifiable token remains a risk flag, not a guess.

**Incident mechanics.** When something breaks, a mechanism-level post-mortem within 48 hours: trigger, amplifier, and mechanism, held separately — never a single blessed "cause" — with every causal claim recorded alongside who made it, when they made it, and what their incentive was.

## 04 Foundation: base agent and corpus

**Base agent.** We build on SERA-CryptoAgent (sentient-agi, open source). Its 50+ tool endpoints and embedding-based router become our live-query layer. We extend its hands rather than fork its brain: LensAI's proprietary stores are wrapped as additional tool endpoints its router can select. The base carries none of our guardrails; those are enforced in our narration layer and verified on output.

**Corpus and capture.** Articles and filings are captured immutably at ingest — content-hashed, with publication time and capture time stored separately, so a later edit can never rewrite history. Extraction is typed, not sentiment-scored: entities, listings, collateral acceptance, oracle sources, and mechanism claims, each claim stored with claimant, claimant's incentive, and time of claim. Capture is the one asset that cannot be built retroactively; it precedes everything else.

## 05 The engine

**Factor state store.** Six factor families at launch: funding, basis and yield, macro (rates, the dollar), institutional flows, depth and liquidity, and news. Every stream is normalized against its own history — "funding is in its 92nd percentile," never "funding is 0.01%" — regime-tagged, and joined on one clock. Expansion beyond six comes only after the join is live and scored.

**Mechanism graph.** A hand-curated, finite map of documented transmission channels: funding ↔ basis trade ↔ ETF arbitrage; stablecoin float → spot buying power; real yields and the dollar → risk appetite; depth → gap risk. Curation, not discovery. News events map onto nodes of this graph — which is where "hidden inside the articles" becomes structure rather than vibes.

**Divergence engine.** Pure arithmetic. It flags factor states that are historically extreme and relationships that have broken — price at highs while inflows stall and depth thins. The hidden dots are found by measurement; the model never gets to invent them.

**Narration layer.** The model writes the brief under one rule: every stated connection is (a) measured in the store, (b) mechanical via the graph, or (c) explicitly labeled conjecture. Numeric claims are checked against the store before release; unsupported claims are stripped, not softened. This labeling rule is the product's integrity.

## 06 The moat

Anyone can buy the silos. Nobody sells the join. Four assets compound daily and none can be assembled after the fact: the normalized cross-factor history, the immutable point-in-time corpus, the curated mechanism graph, and the calibration record.

The reads and regularities the system surfaces — the outputs — are public and perishable by design: publication invites copying, and use erodes edge. That is acceptable, because the outputs were never the asset. The engine is.

## 07 Non-advisory by construction, v2

v1's rules carry forward unchanged: never buy, sell, "you should," a price target, or an allocation; frame every read as an assessment of current structure; when data is thin, raise the uncertainty as a risk rather than filling the gap.

v2 adds the rules a pattern-capable system needs. Any regularity ships with its evidence — instance count, base rate, hit rate, regimes covered — and a lifecycle badge: validated, decaying, or broken. Dead patterns stay published, badged as dead. Honesty about decay is a feature, not a confession.

## 08 Evidence and evaluation

The missing chapter of v1 is core in v2. Point-in-time discipline applies everywhere: the system reasons only over what existed at the moment in question — no lookahead, ever. Every Market State read and every overall token read is logged and scored against forward outcomes under proper scoring rules — to measure calibration, not to claim prediction. A guardrail red-team suite runs on every prompt and template change. Attribution checks verify that cited sources actually support the claims that cite them.

## 09 Identity, privacy, and proof

Sign-In With Ethereum, unchanged: no email, no password, no traditional personal information; multichain, including new ecosystems as they emerge. Research history remains sensitive — the tickers a person studies hint at holdings — so deletion stays a first-class, one-action path, and individual queries never touch a chain.

For public proof of traction, aggregate usage may be committed on-chain as periodic hashes: tamper-evident timestamps of our own numbers, revealing nothing until we choose to reveal, with per-wallet attestations as a later option.

## 10 Build sequence

Capture first, in week one — the only step where lost calendar time is unrecoverable. Then, in order: factor store and joins; mechanism-graph curation; divergence engine and event-study statistics; wrapping the stores as base-agent tools; the narration surface last.

Validation is built into the sequence: be live before the next market incident. The 48-hour mechanism brief on a live event is simultaneously the product demo and the demand test — and the metric is unprompted return, not signups.

## 11 Costs, dependencies, and risks

Depth and institutional-flow feeds are priced for funds; quotes precede architecture. The base agent is a dependency: licenses vary by repository, upstream can drift, its data endpoints are bring-your-own-keys, and its maintainers could enter this vertical. Self-hosting open-weight models is a real infrastructure step up from an API key. Storing full article text carries licensing obligations that vary by source. Regime shifts can break relationships the graph assumes — the divergence engine's job is to notice, and the honest failure mode is to say so. And demand is unproven until the incident test runs; nothing in this document substitutes for it.

Analysis never connects to execution. Any future feature that touches execution or authorized agents goes to counsel before it goes to design.

## 12 What LensAI is not

Not a signal service. Not price prediction. Not a trading bot, and never a buy button. Not a cycle-theory narrative machine — the four-year cycle is context the system can reference, never a pattern it "finds."

Crypto is highly volatile and you can lose money. LensAI exists to make your own research better — the decision is always yours.
