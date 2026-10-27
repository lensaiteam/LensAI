---
description: Capture, normalize, connect, flag, narrate, verify.
---

# Overview

The engine is the intelligence of LensAI. The language model only narrates what the engine has already measured.

```
capture ──▶ factor state store ──▶ mechanism graph ──▶ divergence engine
   │          (normalize against own history,                │
   │           regime-tag, one clock)                        ▼
   └──────────────────────────────▶ tool layer ◀──── narration + verification
                                        │                    │
                                        ▼                    ▼
                                 outside agents      briefs, calls, the record
```

| Stage | Job | Detail |
|---|---|---|
| [**Capture**](capture.md) | Record every article and market observation, immutably, with the time LensAI learned it. | Polled feeds every few minutes to daily; liquidations pushed live. |
| [**Factor state store**](factor-store.md) | Turn every raw stream into a percentile against its own history, tag its regime, join everything on one clock. | Hourly anchors; 90-day, 365-day and full-history windows. |
| [**Mechanism graph**](mechanism-graph.md) | Record the documented channels through which one factor moves another. | Curated, versioned, append-only. |
| [**Divergence engine**](divergence.md) | Flag extreme states, broken relationships and structural signatures. | Pure arithmetic. |
| [**Narration and verification**](narration.md) | Write the brief and propose the call, then verify every claim before release. | One structured generation; fail-closed gates. |
| [**Tool layer**](tool-layer.md) | Expose the stores as read-only, point-in-time tools for the desk and for outside agents. | JSON-RPC over HTTP and stdio. |

## Design rules that run through every stage

* **Point-in-time everywhere.** Every read takes an "as of" moment and cannot see anything captured after it. Lookahead bias is structurally impossible, not merely discouraged.
* **Append-only.** Raw observations, the mechanism graph, briefs and calls are never updated or deleted. Database triggers reject mutation, and tests prove it.
* **Fail closed.** Missing data produces an honest gap, a withheld value or a no call. It never produces an estimate.
* **Model-agnostic.** The engine does not depend on any one language model. Models can be swapped or added without changing what makes LensAI valuable.
* **Tested.** The engine carries a test suite that runs on every change, including red-team suites for the non-advisory guardrail and the call policy.

## Infrastructure

The engine runs as one always-on service: capture daemon, live feeds, the hourly derive cycle (normalize, regimes, divergence, shared brief, watches) and the HTTP API, in a single process. The corpus is stored in SQLite with portable SQL and a migration path to Postgres when a second service needs it, and is set up for continuous off-site replication of the database, because the corpus is the one asset that cannot be rebuilt. The website and desk are a Next.js application served separately.
