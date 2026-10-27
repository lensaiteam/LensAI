---
description: Every reading as a percentile against its own history, regime-tagged, on one clock.
---

# Factor state store

A raw number rarely means anything on its own. A funding rate of 0.01% per eight hours is unremarkable for one asset in one year and stretched in another. LensAI therefore never reasons over raw values. Every stream is normalized **against its own history**.

> "Funding is in its 96th percentile", never "funding is 0.0135%".

## Factor families

The store reads the market through a set of factor families, each a group of measured streams:

| Family | Streams today |
|---|---|
| **Funding** | Perpetual funding rate, per venue and asset |
| **Leverage** | Open interest; hourly liquidations, long and short |
| **Depth** | Resting order-book liquidity near the mid price |
| **Spot** | Spot price and volume |
| **Liquidity** | Aggregate stablecoin float |
| **Macro** | US dollar index, US 10-year yield |
| **News** | The article corpus and typed claims |

## Normalization

For each stream, at each anchor, the store computes the stream's percentile over three named windows:

* **90 days**: the recent regime;
* **365 days**: the main reference window, used for extreme-state flags;
* **full history**: everything captured.

A percentile is the share of the window's observations at or below the current value. Rules that keep it honest:

* **Minimum history.** A window with fewer than 30 observations does not produce a percentile. The value is kept and marked as having insufficient history.
* **Staleness.** Every reading carries how old its latest observation is, so a stale feed is visible instead of silently reused.
* **Vintage.** Each reading records whether it was computed from data truly available at the time (true point-in-time) or from a later vintage of the same data, such as a revised macro series.
* **Event streams are not ranked.** A single liquidation is an event, not a level. Raw events are kept in the corpus, and their hourly totals are what the store normalizes.

## One clock

Everything is joined on one canonical clock: **hourly anchors**. Two times are kept apart throughout:

* the **observed** time, which places a reading in the window;
* the **captured** time, which decides whether the reading was known at the anchor.

Because every read is gated on capture time, the whole state can be recomputed at any past instant exactly as it would have looked then. That is what makes an honest calibration record possible.

## Regimes

Each factor reading is tagged with the regime it sits in, so it is read in context:

| Regime | Labels |
|---|---|
| Funding regime, per asset | Elevated, neutral, suppressed |
| Open-interest regime, per asset | Elevated, neutral, suppressed |
| Dollar regime, market-wide | Strong, neutral, weak |

Regime tags feed the mechanism graph (some channels only apply in some regimes) and the divergence engine's structural signatures.
