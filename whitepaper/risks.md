---
description: What can go wrong, and what LensAI does about it.
---

# Risks and limits

LensAI is only as good as the data it can gather and the discipline it keeps. The system is built to show its limits rather than paper over them.

## Limits of the product

* **Calls can be wrong.** A call is a probability, not a promise. At 65% confidence, roughly one call in three should miss. The record shows every miss.
* **Coverage is narrow today.** Live coverage is BTC, ETH and SOL across a small set of venues. Binance liquidation data is a sample. ETF flows and institutional-grade depth are not yet wired. Where the desk does not measure something, it says so.
* **Upstream data can be wrong.** Exchanges and data providers can be late, incomplete or revised. LensAI records what it learned and when; it cannot make a wrong source right.
* **Relationships change.** A mechanism that held in one regime can break in another. The divergence engine's job is to notice, and the honest failure mode is to say so.
* **History takes time.** A new stream has no percentile until it has enough history. New coverage starts quiet by design.

## Business and operating risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| Calls go wrong in public | A confident miss costs more trust than a hedged one. | Confidence and a wrong-if condition on every call; misses shown first; no calls on thin data; any call type that keeps missing is reviewed. |
| Calls read as personal advice | Bluntness can be mistaken for instruction. | The same call for everyone, published at once; no personal instructions; no securities coverage; counsel review. |
| Conflicts of interest | Calls on held tokens invite manipulation claims. | No calls on held or related tokens, $LENS included; disclosure policy; trading policy with blackout periods. |
| Free usage outruns the budget | Bots can farm free research. | Sign-in for deep reads, daily caps, a cost budget, shared briefs that cost nothing per reader. |
| Platform dependence | Social platforms change rules and cut access abruptly. | Tag-only labelled bot; Telegram, web and agent channels as fallbacks. |
| An incumbent copies the format | Large exchanges have distribution and their own data. | The record cannot be backfilled, so it starts now; an exchange cannot credibly grade itself. |
| Defamation | Incident briefs can name people and venues. | Record disclosed roles, not motives; legal review before briefs that name people. |
| Data licensing | Some data tiers are for personal use only; article text carries per-source terms. | Commercial licences for commercial use; a redaction path in the append-only store. |
| Upstream dependencies | The open-source base agent and data providers can change or stall. | Model-agnostic engine; the base agent is wrapped, not forked; sources are configuration. |
| Execution | A small team with a growing surface. | Sequence by the roadmap's gates; cut scope before reliability. |

## What LensAI will not do

* Connect analysis to execution. Any future feature that touches trading or authorised agents goes to counsel before it goes to design.
* Call itself fully automated if humans review its output, or claim accuracy it has not measured.
* Post AI-written reports where communities ban them, or reply unprompted on social platforms.
