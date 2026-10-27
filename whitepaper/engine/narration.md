---
description: The model writes under one rule. Every claim is checked before release.
---

# Narration and verification

Narration is the last stage and the only one that uses a language model. It turns the engine's measured state into a short read and a proposed call, under one rule:

> Every stated connection is **(a) measured** in the store, **(b) mechanical** through the graph, or **(c) explicitly labelled conjecture**.

## The pipeline

```
gather (point-in-time) ─▶ generate (structured) ─▶ verify numbers ─▶ check mechanisms
          ─▶ non-advisory guardrail ─▶ gate the call ─▶ render ─▶ final guardrail ─▶ record
```

1. **Gather.** The context is assembled from the point-in-time tool layer: factor percentiles with their store references, regimes, fired flags, mechanism edges, recent news and typed claims, plus the call inputs (asset, stored price, how much history stands behind it). The model never sees raw feeds.
2. **Generate.** The model returns a structured object, not free prose: a headline, a list of atomic **claims** (each with its basis, the references it cites and every number it states), and a proposed **call**.
3. **Verify numbers.** Every number must resolve to a stored value at the same anchor, within 1%. This includes numbers written only in the prose and never declared: a model cannot slip "94th percentile" into a sentence and bypass the check.
4. **Check mechanisms.** A claim marked mechanical must cite a real edge in the graph.
5. **Guardrail.** Anything that reads as an instruction to the reader is dropped.
6. **Gate the call.** The proposed call passes the engine's own gates and either becomes a published call or a no call with its reason (see [The call](../the-call.md)).
7. **Render and record.** Surviving claims are assembled into the brief, checked once more as a whole, and appended to the record with the full audit: which claims were kept, which were dropped, and why.

A claim that fails any gate is **dropped, not softened**. If nothing survives, the desk retries once on a different model, then shows the measured state.

## The record of what was said

Every shared brief is appended to an immutable record with its anchor, its text, the store references its surviving claims cite, its full claim audit, the model that wrote it and the code version. Its call is appended to the calls record alongside it. Together these are the calibration record: what the desk said, on what evidence, at what moment, and later, how it turned out.

## Models

LensAI is model-agnostic. Narration runs on a configurable multi-provider pool with quota-aware failover; each model is admitted only after passing fixed cases through the real verification gates. Because the engine does the measuring and the gates do the checking, swapping a model changes the wording, not the truth.
