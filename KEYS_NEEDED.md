# KEYS_NEEDED.md

Credentials the capture layer wants but does not yet have. **Rule (invariant): a
stubbed source NEVER emits fake-but-plausible data.** Until a key here is filled
in, its adapter either fetches nothing (free sources degrade to an `ingest_runs`
error row) or throws `NotImplemented` (paid stubs) — it does not invent numbers.

## Free — fill in to widen coverage

| Key | Source | Used for | Where to get it |
|---|---|---|---|
| `FRED_API_KEY` | FRED (St. Louis Fed) | Macro: DXY proxy `DTWEXBGS`, 10y `DGS10` | https://fred.stlouisfed.org/docs/api/api_key.html (free) |

Without `FRED_API_KEY` the macro adapter records an `ingest_runs` error each tick
(visible in `npm run capture:tail`) instead of silently producing a corpus gap.

## Paid / institutional — stubbed interfaces only (Phase 1)

These are priced for funds. The spec says: define the interface, stub it, list it
here. `src/lib/capture/adapters/stubs.ts` throws `NotImplemented` for each.

| Key | Source | Would provide | Status |
|---|---|---|---|
| `ETF_FLOWS_API_KEY` | (vendor TBD) | Spot BTC/ETH ETF creation/redemption flows | stub — quote vendors before wiring |
| `INSTITUTIONAL_DEPTH_API_KEY` | (vendor TBD) | Institutional-grade order-book depth | stub — coarse public depth used meanwhile |

Coarse ±1%/±2% depth from exchange public endpoints (Binance) covers the depth
factor for now; the institutional feed is an upgrade, not a blocker.
