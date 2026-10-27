---
description: Curation, not discovery. A finite map of how one factor moves another.
---

# Mechanism graph

Most "X happened because of Y" explanations in crypto are stories. LensAI keeps a hand-curated, finite map of **documented transmission channels**: the mechanical ways one factor moves another. A connection the desk states is either measured, mechanical through this graph, or explicitly labelled conjecture.

## What is in it

The graph is made of **nodes** (measured factors such as funding, depth or stablecoin float, and concepts such as the basis trade, spot buying power or risk appetite) and **directed edges** (one node acting on another, with a polarity and a written mechanism).

The current seed covers the core channels:

| Channel | Mechanism, in brief |
|---|---|
| Funding and the basis trade | Rich funding draws cash-and-carry capital (long spot, short perp), whose shorting presses funding back toward neutral. |
| Basis trade and ETF arbitrage | ETF creation and redemption arbitrage connects spot ETF demand to the basis that carry traders harvest. |
| Stablecoin float to spot buying power | Circulating stablecoins are on-chain dry powder; growth adds capacity to bid spot. |
| Real yields to risk appetite | Higher real yields lift the risk-free alternative and the discount rate, weighing on risk assets. |
| The dollar to risk appetite | A stronger dollar has coincided with lower risk appetite across assets. |
| Depth to gap risk | Thin resting liquidity near the mid price makes discontinuous moves more likely on a given flow. |

The graph is a seed, built to grow: liquidation cascades, auto-deleveraging and cross-venue channels come next as the data for them arrives.

## Rules

* **Curation, not discovery.** Channels are written and reviewed by people from documented market mechanics. The engine does not invent relationships.
* **Versioned and append-only.** A change is a new graph version, never an edit. Every read takes the version that was current at its as-of time, so past reads stay reproducible.
* **Permanent ids.** A node or edge id never changes meaning. A renamed concept is a new id, with the old one marked deprecated.
* **Directed only.** A two-way relationship is two edges sharing a channel.
* **Regime-aware.** An edge can state the regimes in which it applies and those in which it is known to break.
* **Strength is a prior.** Each edge carries a curated strength, labelled everywhere as a prior until the calibration record can measure it.
* **Guardrailed.** Every prose field in the graph passes the same non-advisory checks as the desk's output, in CI.

## How it is used

* **Narration:** a claim marked "mechanical" must cite a real edge id, or it is dropped.
* **Divergence:** the engine checks graph relationships between measured factors and flags those that have broken.
* **Claim Check:** a causal claim in a pasted post counts as documented only when it maps to an edge.
* **Evidence:** answers show the channels in play, with the ones they cited marked.
