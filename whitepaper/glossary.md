# Glossary

**Anchor.** The hourly moment at which the engine computes the whole market state. Every read, brief and call is tied to one.

**As of.** The moment a read is anchored to. Nothing captured after it can be seen.

**Basis trade.** Holding spot and shorting the perpetual (or future) to earn the difference and the funding.

**Calibration.** How well stated confidence matches outcomes. A calibrated desk is right about 70% of the time on calls it makes at 70%.

**Call.** The one committed view a market or token read ends in: direction, stance, confidence, horizon, price at publication and a wrong-if condition.

**Claim (typed).** A causal assertion from a source, stored with who made it, their role, when, and the mechanisms it refers to.

**Conjecture.** A statement that is neither measured nor mechanical. LensAI labels it as such.

**Coverage.** The share of an hour that a live feed was confirmed connected. Below 95%, the hour's liquidation total is withheld.

**Divergence.** A flag from the divergence engine: an extreme state, a broken relationship or a structural signature.

**Factor.** A measured market stream, such as funding rate, open interest or stablecoin float.

**Funding rate.** The periodic payment between long and short holders of a perpetual contract; a gauge of leverage demand.

**Leverage-led / spot-led.** Whether a move is driven by leveraged derivatives positioning or by spot buying.

**Liquidation.** A position closed by the exchange because its margin ran out.

**Mechanical.** A connection drawn through a documented channel in the mechanism graph, citing its edge.

**Mechanism graph.** LensAI's curated, versioned map of how one factor transmits to another.

**Measured.** A statement read directly from the store at the anchor.

**No call.** An explicit statement that the data does not support a call, with its reason. Recorded and counted like a call.

**Open interest.** The total size of open derivatives positions.

**Percentile.** A reading's rank within its own history over a window: the share of past observations at or below it.

**Point-in-time.** Reasoning only over what existed at a given moment, with no lookahead.

**Regime.** The context a factor sits in, such as elevated, neutral or suppressed funding.

**Sampled.** A venue feed that publishes only part of its events. Its totals are a floor.

**Wrong if.** The observable condition that would prove a call wrong.
