---
description: Five invariants, enforced in code and proved by tests, not promised in prose.
---

# Trust by construction

Most products ask to be trusted. LensAI is built so that the important properties are enforced by the code and checked by automated tests on every change. Each invariant below exists in code **and** in a test that fails if it is broken.

## The five invariants

**1. Immutable capture.** Every article and observation is hashed at ingest. Source time and capture time are separate columns. No row in the corpus, the mechanism graph, the briefs or the calls is ever updated or deleted; corrections are new rows. Database triggers reject mutation, and a test proves that mutation attempts fail.

**2. Point-in-time everywhere.** Every read in the data layer requires an "as of" time and never returns anything captured after it. This is enforced inside the data layer, not left to each caller, so lookahead bias cannot creep in.

**3. Nothing tells the reader what to do.** No output may instruct a reader: no buy or sell aimed at them, no "you should", no allocations, position sizes, leverage or stops, and no guarantees. The written analysis is stricter still and also carries no price targets. The one place a level or a probability may appear is **the call**, which is a public market view, the same for everyone, under its own policy (see [The call](the-call.md)). A red-team test suite for both runs in CI.

**4. Numeric traceability.** Every number the desk publishes resolves to a stored row at the same anchor, including numbers that appear only in prose. A claim that cannot be traced is dropped.

**5. Typed claims, not sentiment scores.** Causal assertions from sources are stored with who made them, their disclosed role, when, the text, and the mechanisms they refer to. News is never reduced to a mood number.

## Evidence and evaluation

* **Point-in-time discipline** applies to evaluation too: past reads and calls are scored only against what came after them.
* **Calibration** is measured with proper scoring rules, not claimed. See [The call](the-call.md).
* **Dropped claims are kept.** Every brief records which claims were dropped and why: an unverified number, a mechanical claim with no real edge, or advisory language. The record shows the desk's failures, not only its output.
* **Model admission.** A model is only used after it passes fixed test cases through the real verification gates.
* **Honest decay.** A pattern or relationship that stops holding is not quietly removed. Flags and graph edges carry their evidence and lifecycle; a broken one stays visible as broken.

## What the gates cannot do

Verification proves that a number matches the store and that a mechanism exists in the graph. It cannot prove that a call will come true, that a source was honest, or that the store's upstream data was correct. Those limits are why the record exists: it is the only honest test of a desk that makes calls. See [Risks and limits](risks.md).
