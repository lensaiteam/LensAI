---
description: One committed view per read, or an honest "no call". Published as made, never edited, scored in public.
---

# The call

Every market read and every token read ends in **one call**. This is the centre of LensAI: the desk does not list pros and cons and leave the judgement to the reader. It commits, it says what would prove it wrong, and it lets the record show how often it is right.

Calls are **free and public**. Everyone who asks sees the same call.

## What a call contains

| Field | Meaning | Who sets it |
|---|---|---|
| **Asset** | The token the call is on. A whole-market read calls BTC. | The engine |
| **Direction** | Up or down: where the price goes from the price at publication over the horizon. | The model proposes |
| **Stance** | A short structural label, for example "Leverage-led, fragile". | The model proposes |
| **The call** | One plain sentence. | The model proposes |
| **Confidence** | The probability that the direction is right, from 50% to 90%. | The model proposes; the engine clamps it |
| **Horizon** | 1, 3, 7, 14 or 30 days. | The model proposes from an allowed list |
| **Price at publication** | The latest stored spot price, no older than six hours. | The engine, never the model |
| **Wrong if** | The observable condition that would prove the call wrong. | The model proposes |
| **Published at, resolves at** | The anchor the call was made at, and that time plus the horizon. | The engine |

{% hint style="info" %}
**An example of the format (illustrative, not a live call):**
*Leverage-led, fragile. Down.* "This bounce is leverage-led and likely to fade within the week." Confidence 65%, next 7 days, from the price at publication. Wrong if spot ETF inflows top $500M a day while funding cools below its 70th percentile.
{% endhint %}

## Who decides what

The model proposes the view. The **engine owns everything that must not be the model's word**, and it fails closed:

1. **The asset and the price.** The price at publication comes from the store, and the call carries a reference to the exact row.
2. **Thin data.** If fewer than three readings for the asset have enough history to be ranked, or there is no price from the last six hours, there is no call, whatever the model says.
3. **Blocked assets.** The desk never calls a token the team or related projects hold, $LENS included. A call that even names one is refused.
4. **The call policy.** A call may state a market view, a price level and a probability. It may not tell the reader what to do: no buy or sell aimed at the reader, no position sizes, no leverage, no stops, no guarantees.
5. **Numbers.** Every number in the call's text must resolve to a stored row, like every claim.
6. **Completeness.** A call without a direction, stance, allowed horizon, confidence of at least 50% or a wrong-if condition is not published as a weaker call. It becomes a no call.

Confidence above 90% is capped at 90%. No market view is a certainty.

## No call

When the data cannot support a direction, the desk says so: **"No call"**, with the reason:

* the data is too thin, or there is no fresh price;
* the asset is one the desk does not call;
* the desk itself judged the evidence too mixed;
* the proposed call failed a check.

A no call is not a failure to hide. It is **recorded and counted** in the record like any call. Research on AI systems shows that a model which is willing to say "I don't know" is wrong far less often than one that always answers. A desk that can be silent is a desk whose calls mean something.

## The public record

* **Every call is recorded as it is made**, in an append-only table that rejects any edit or deletion at the database level. A correction would be a new call, never a changed one.
* **Only recorded calls are ever shown.** Calls are filed with the shared market and token briefs. When a user asks a specific question, the answer shows the call already standing on the record for that asset. No user's question ever creates a private, unrecorded call, and the screen can never differ from the record.
* **Calls will be posted publicly as they are made**, to the site's call log and a public channel whose timestamps cannot be changed.

## Scoring: calibration, not a win rate

Each call resolves at its horizon against the stored price. The record is then scored for **calibration**: of all calls made at around 70% confidence, how many came true? A well-calibrated desk is right about 70% of the time at 70%, about 60% of the time at 60%, and so on.

LensAI will publish a monthly scorecard, **misses first**, together with:

* the number of calls and no calls in the period;
* the hit rate at each confidence level;
* proper scoring-rule results, so overconfidence is penalised;
* a "verify a call" page linking each call to its data, its post and its outcome.

Win rates are easy to flatter: a record that counts any gain as a win looks impressive while being useless to follow. Calibration is harder to flatter, and it is what tells a reader how much weight a call deserves.

## Where blunt stops

| Blunt and fine | Over the line |
|---|---|
| A market view: "This rally is leverage-led and likely to fail within a week (65%)." | A personal instruction: "Sell your BTC now", or anything built around someone's holdings, size or leverage. |
| A structural verdict: "Red flag: five wallets hold 40% of supply." | A call on a token the team, treasury, partners or market makers hold, $LENS included. |
| A fact verdict: "False: the outflow was about $19M, not $17B." | "Guaranteed", "can't lose", or return claims. |
| The same call, published to everyone on a regular cadence. | Copy-trading, auto-trading or pre-filled order links. |
| "No call: the data does not support one." | Deleting or editing a call, or trading ahead of or against one. |

The line sits where regulators in major jurisdictions draw it: impersonal commentary published to everyone is treated differently from tailored advice to one person. Keeping calls free, public and identical for everyone is part of staying on the right side of that line. LensAI's calls are generated by an automated system and labelled as such.
