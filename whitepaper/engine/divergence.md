---
description: Pure arithmetic. The model never gets to invent the dots.
---

# Divergence engine

The divergence engine finds what is unusual. It is pure arithmetic over the factor store and the mechanism graph, and it runs at every anchor. The "hidden dots" the desk talks about are found by measurement; the model only describes them.

## Three kinds of flag

**Extreme state.** A factor whose 365-day percentile is at or above the 95th, or at or below the 5th. Funding at the top of its year, depth at the bottom of its year, liquidations at a yearly high.

**Broken relationship.** A channel in the mechanism graph whose two ends are moving against the documented mechanism. Only edges where both ends are measured factors can be checked this way, so this flag grows in reach as the graph gains factor-to-factor channels (for example, liquidations to depth, or stablecoin float to spot volume).

**Structural signature.** The flagship question of Market State: is this move spot-led or leverage-led?

| Signature | Fires when |
|---|---|
| **Leverage-led** | The funding regime is elevated and open interest is historically elevated. |
| **Spot-led** | Funding is not elevated and open interest is calm. |
| **Fragile** | The move is leverage-led and funding is stretched. |

When the inputs for a signature are missing or have too little history, the signature is recorded as **indeterminate**, never guessed.

## Properties

* **Deterministic.** The same store at the same anchor always produces the same flags.
* **Point-in-time.** Flags are computed only from what was captured by the anchor, and stored with it, so the record shows what the engine saw then.
* **Feeds everything.** Flags appear on the live pulse, in the evidence of every answer, in the context the model narrates, and as conditions a watch can describe.
