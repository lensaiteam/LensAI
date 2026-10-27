---
description: Nine ways of reaching one engine. None of them is an open-ended tool loop.
---

# The agents

LensAI's agents are not separate products. They are nine ways of reaching the same engine, and they share the same evidence, the same gates and the same record.

| Agent | What it answers | Model calls |
|---|---|---|
| **Market State** | Where every factor sits, what broke, spot-led or leverage-led, and the call on the market. | None per reader: one shared brief per hourly anchor. |
| **Token Briefing** | One token's state in market context, ending in a call on that token. | None per reader when it is a generic read; one for a specific question. |
| **Incident Mechanics** | What broke, separated into trigger, amplifier and mechanism, with every causal claim attributed. | One. |
| **Mechanism** | How one factor transmits to another, from the curated graph. | Usually none. |
| **What Changed** | What moved between the anchor you last saw and now. | None: arithmetic. |
| **Watch** | Tells you when a described market state becomes true. | One, once, to translate the watch. Then none. |
| **Claim Check** | Whether the claims in a post match the stored data. | One, to extract the claims. The verdict itself is arithmetic. |
| **The Record** | Every brief and call the desk has filed, with its outcome. | None. |
| **Tool Endpoint** | The same stores for outside agents and integrations. | None. |

## How an agent works

None of the agents runs an open-ended tool-calling loop. An open loop over a pool of models adds unreliability without adding truth. Instead:

1. **Plan.** Common question shapes are recognised without a model call; only ambiguous questions spend one small call.
2. **Gather.** The agent reads the point-in-time tool layer deterministically.
3. **Generate once.** At most one structured generation: a list of atomic claims, each typed as **measured**, **mechanical** or **conjecture**, and a proposed call.
4. **Gate.** The claims pass the same fail-closed checks as every scheduled brief:
   * every number, including one written only in the prose, must resolve to a stored row, or the claim is dropped;
   * a mechanical claim must cite a real edge in the mechanism graph, or it is dropped;
   * anything that reads as an instruction to the reader is dropped.
5. **Fall back honestly.** If nothing survives, the agent retries once on a different model. If that fails too, it shows the measured state. It never guesses and never errors at the user.

## Model calls are spent last

The state of the market is the same for every reader, so the Market State brief is generated once per hourly anchor and served to everyone. What changed is a subtraction between two anchors. A watch is a rule evaluated over derived tables. The record is a read from an append-only table. None of these calls a model, which means none of them can hallucinate.

A model is used only where language is the job: translating a plain-language watch into a rule once, extracting claims from pasted text, and answering a specific question. The models sit behind a configurable multi-provider pool with quota-aware failover. Each model is admitted only after it passes fixed test cases through the real verification gates. When capacity runs out, the agents degrade to the measured state rather than to an error.

## Watches

A watch is said once in plain language, for example "tell me when BTC funding is above its 90th percentile while open interest is falling". A small model translates it into a rule over measured state; the desk echoes the rule back in exact terms; the user confirms it. From then on it is arithmetic:

* evaluated once per anchor;
* fired only on the transition from false to true, not every hour it stays true;
* bounded by a cooldown;
* silent when data is missing, never firing on a gap.

A watch can describe a market state. It cannot encode an instruction, and price-level alerts are refused.

## Claim Check

Claim Check inverts the usual trust. The model only extracts what a post asserts and maps each number to the stored row that measures the same thing. The verdict is computed, not judged:

* **Supported:** the stored value matches within 1%.
* **Contradicted:** the stored value is shown next to the claimed one.
* **Unverifiable:** the desk does not measure it, and says so.

A causal claim counts as documented only when it maps to a real edge in the mechanism graph. Instructions inside the pasted post are reported, never repeated. Claim Check verifies numbers and mechanisms; it does not judge whether a post was paid for.

## Incident Mechanics

When a market breaks, LensAI aims to publish within 48 hours: what broke, held apart as trigger, amplifier and mechanism, never a single blessed "cause". Every causal claim is recorded with who made it, when, and their disclosed role. The engine's flags show what was measurably abnormal; the liquidation history shows what was forced. Incident reads describe what happened, so they carry no call.
