---
description: The crypto research desk that takes a stance and keeps score.
---

# LensAI Whitepaper

**Connect the dots. Show the work.**

LensAI is an automated research desk for crypto. It reads funding, open interest, liquidations, order-book depth, spot, stablecoin liquidity, macro and news together, on one clock, each measured against its own history. Then it does what most research products avoid: it makes **one clear call**, shows every number it used, and publishes that call to a permanent public record where it is scored, misses included.

**LensAI is live** at [scanbylens.xyz](https://scanbylens.xyz). The desk, the engine, the nine agents, live liquidation capture and the call are all running in production today.

This paper describes what LensAI is, how the engine underneath it works, why its outputs can be trusted, how it stays free for the people who use it, and how the $LENS token is designed to fit the product once it launches.

## The short version

| | |
|---|---|
| **What it is** | A research desk at [scanbylens.xyz/app](https://scanbylens.xyz/app). Ask about the market, a token, a mechanism or something that just broke. |
| **What you get** | One call: a direction, a stance, a confidence, a time horizon, the price when it was published, and the condition that would prove it wrong. Or an explicit "no call" when the data cannot support one. |
| **What sits behind it** | Every evidence block the desk read, every number traced to a stored, timestamped row, every causal link either measured, drawn from a curated mechanism graph, or labelled conjecture. |
| **How it keeps itself honest** | Calls are posted as they are made, never edited or deleted, and scored for calibration. A call at 70% confidence should come true about 70% of the time, and the record shows whether it does. |
| **What it costs** | Nothing for users. Calls and deep research are free. Businesses will pay for API volume, team tools and data licensing. |
| **What it never does** | Tell anyone what to do with their own money. The same call goes to everyone, with no position sizes, no entries or stops, no guarantees, and no calls on tokens the team or related projects hold, $LENS included. |

## Why this matters

Free tools now explain price moves without taking a position. Confident AI callers take a position and keep no record. Both fail the person trying to understand the market: the first leaves the judgement to them, the second gives a judgement they cannot check.

LensAI does both halves. It takes a stance, and it keeps score in public.

## How to read this paper

* [**The problem**](the-problem.md) and [**What LensAI is**](what-lensai-is.md) set out the gap and the product.
* [**The desk**](the-desk.md), [**The agents**](agents.md) and [**The call**](the-call.md) describe what a user sees and does.
* [**The engine**](engine/README.md) explains the pipeline, from capture to verified narration.
* [**Trust by construction**](trust.md) and [**Privacy and identity**](privacy.md) cover the guarantees built into the code.
* [**Economics**](economics.md), [**The $LENS token**](token/README.md) and [**Roadmap**](roadmap.md) cover the business, the token and what comes next.
* [**Risks and limits**](risks.md) and [**Disclaimer**](disclaimer.md) are worth reading before anything else.

{% hint style="warning" %}
Crypto is highly volatile and you can lose money. LensAI publishes market research and calls on the market as a whole. It does not give personal financial advice. Nothing in this paper is an offer to sell or a solicitation to buy any token.
{% endhint %}
