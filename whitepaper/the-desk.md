---
description: Ask once. See what the desk read. Get one call.
---

# The desk

The desk is LensAI's main surface, at [scanbylens.xyz/app](https://scanbylens.xyz/app). It is built product-first: the first thing anyone sees is a question box.

## Before you ask: the live pulse

Under the question box, the desk shows what it sees right now, built from the engine's latest anchor and identical for every visitor:

* **A live tape** of every venue reading: funding, open interest, hourly liquidations, depth, spot, stablecoin float and macro, each with its percentile against its own history and a small recent series. Readings at a historical extreme are marked.
* **Counted facts:** how many readings, how many venues, how many sit at an extreme, and how recently the anchor was computed.
* **The latest market read:** the headline of the most recent shared brief and how many of its claims survived verification.
* **Engine flags:** the states and relationships the divergence engine has flagged.
* **Just filed:** the newest headlines from the news corpus, with source and time.

Anyone can read the pulse. Asking a question opens sign-in.

## Asking

A question can be about the market ("Is this move leverage-led?"), a token ("Is BTC funding confirmed by open interest?"), a mechanism ("How does the basis trade connect funding to ETF flows?"), what changed since you last looked, or an incident.

While the desk works, it shows its run in real time:

1. **Plan:** what the question is about and which assets it covers.
2. **Gather:** the agents read the point-in-time stores. Each evidence block appears on screen as soon as it exists.
3. **Write:** at most one structured generation, only when the question needs language.
4. **Verify:** every claim passes the same gates as a scheduled brief before anything is shown.

## The answer

An answer has three tabs.

**Answer.** A strip of the sources the desk read (with real venue and outlet logos), the **call card**, then the verified read itself, written in short paragraphs, with related follow-up questions underneath.

**Evidence.** Every block the agents gathered:

| Block | What it shows |
|---|---|
| Stream readings | Per venue: the value, its percentile against its own history, the window used, how much history stands behind it, how fresh it is, and a recent series. |
| Regimes | The regime each factor sits in (for example, funding elevated, neutral or suppressed). |
| Flags | Extreme states and broken relationships from the divergence engine. |
| Mechanism | The curated channels in play, with the ones the answer cited marked. |
| News | The articles read, each with source, time and the content hash it was captured under. |
| Claims | For incidents: typed claims with who made them and their stated role. |

**Steps.** The run itself: what was planned, what was gathered, how many claims were written, how many survived, and why any were dropped.

## The call card

The call card is the one dark object on the page. It shows:

* the **stance** (for example, "Leverage-led, fragile") and the **direction** (up or down);
* the call in **one sentence**;
* **confidence**, on a scale from 50% to 90%;
* the **horizon** and the time of publication;
* the **price at publication**, taken from the store;
* **wrong if**: the observable condition that would prove the call wrong.

When the data cannot support a call, the card says so: **"No call"**, with the reason. A no call is recorded and counted like any other call. See [The call](the-call.md).

## Other tools on the desk

* **What changed:** the difference between two anchors, as arithmetic. No model call.
* **Watches:** a condition said once in plain language, evaluated every anchor, with alerts by Telegram or email.
* **Claim check:** paste a post and get a verdict for each claim it makes.
* **Account and keys:** alert channels, API keys, export and erase.

Every number on screen that is not a live reading carries a visible **SPECIMEN** label.
