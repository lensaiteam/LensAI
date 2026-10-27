---
description: The one asset that cannot be built retroactively.
---

# Capture

Capture is the first stage and the most important one, because it is the only one where lost time can never be recovered. A day not captured is a day missing from the record forever.

## What is captured

| Stream | Sources | Assets | Cadence |
|---|---|---|---|
| Perpetual funding rate | Binance, Bybit | BTC, ETH, SOL | Hourly |
| Open interest | Binance, Bybit | BTC, ETH, SOL | Every 15 minutes |
| Order-book depth | Binance | BTC, ETH, SOL | Every 15 minutes |
| Liquidations | Bybit (complete), Binance (sampled) | BTC, ETH, SOL | Live, pushed by the exchange |
| Spot price and volume | CoinGecko | BTC, ETH, SOL | Every 5 minutes |
| Stablecoin float | DefiLlama | Total supply | Hourly |
| US dollar index, US 10-year yield | FRED | Macro | Daily |
| News | CoinDesk, Cointelegraph, The Block, Blockworks, The Defiant | All | Polled continuously |

Sources are configuration, not code: adding another source of a supported type is a one-line change. ETF flows and institutional-grade depth are defined in the registry and will be wired when a suitable licensed feed is in place. LensAI never fills a missing feed with plausible-looking data.

## Immutable by construction

* **Content-hashed.** Every article and observation is hashed (SHA-256) over its normalized content at ingest.
* **Two clocks.** The source's own time (when an article was published, when a reading was observed) and the capture time (when LensAI learned it) are always stored separately. A later edit to a source can never rewrite what LensAI knew at the time.
* **Append-only.** No captured row is ever updated or deleted. A correction is a new row. Database triggers reject any attempt at mutation, and a test proves that they do.
* **Idempotent and restart-safe.** Every polled job runs once per scheduled slot. A restart re-runs nothing that already succeeded, and every attempt, success or failure, is logged, so gaps are visible rather than silent.
* **Backfill is labelled.** Historical data imported to seed the percentile windows is marked as backfill and keeps its true capture time, so point-in-time reads stay honest.

## Liquidations: our own capture

Liquidations are the forced side of every crash: positions closed by the exchange because their margin ran out. Every major market break of the last cycle was explained through them, and exchanges push them live and do not keep them for later. LensAI captures them itself.

* **Bybit** publishes every liquidation on its public stream, in batches every half second. LensAI's Bybit data is **complete**.
* **Binance** publishes only the latest liquidation per symbol per second. LensAI's Binance data is a **sample**, labelled as such everywhere it appears, and its totals are a floor, not the venue's whole tape.

Each liquidation is stored raw as an event, with its side (a long or a short being closed), size and price. Each closed hour is then filed per venue and asset with:

* long and short liquidations in US dollars, and the count;
* the share of the hour the connection was actually up.

**A gap is recorded as a gap.** The engine counts coverage only from the moment the exchange confirms the subscription to the last reply to a liveness probe. If the connection was up for less than 95% of an hour, that hour's total is withheld: the partial sums are kept for reference, but the value used for analysis is empty. A quiet hour with full coverage is a measured zero; an hour LensAI was not listening is not.

Hourly liquidation totals are then normalized like any other stream, appear as evidence in answers and on the live tape, and are the backbone of Incident Mechanics.

## Typed claims, not sentiment scores

Alongside raw text, the corpus stores **typed claims**: who made a claim, their disclosed role or incentive, when they made it, the text, and the mechanisms it refers to. LensAI does not reduce news to a sentiment number. A claim is a statement someone made, attributable and checkable.
