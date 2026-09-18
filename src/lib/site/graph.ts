/**
 * The curated mechanism graph as the site draws it — a faithful copy of
 * `config/mechanism-graph.yaml` (graph-v1): ten nodes, eight directed edges, four
 * channels. The site never invents a channel; if the seed changes, change this.
 * `measured` = the node is a captured factor stream; the rest are concepts the
 * graph reasons through.
 */

export const GRAPH_VERSION = "graph-v1";

export const CHANNELS = [
  { id: "basis_arb", label: "Basis arbitrage" },
  { id: "dollar_liquidity", label: "Dollar liquidity" },
  { id: "macro_risk", label: "Macro risk" },
  { id: "liquidity_risk", label: "Liquidity risk" },
] as const;
export type ChannelId = (typeof CHANNELS)[number]["id"];

export interface GraphNode { id: string; label: string; measured: boolean; channel: ChannelId; col: number }
export interface GraphEdge { id: string; src: string; dst: string; polarity: "positive" | "negative"; channel: ChannelId; mechanism: string }

/** `col` is the node's position along its channel's lane (0 = leftmost). */
export const NODES: GraphNode[] = [
  { id: "funding_rate", label: "Funding rate", measured: true, channel: "basis_arb", col: 0 },
  { id: "basis_trade", label: "Basis trade", measured: false, channel: "basis_arb", col: 1 },
  { id: "etf_arbitrage", label: "ETF arbitrage", measured: false, channel: "basis_arb", col: 2 },
  { id: "stablecoin_float", label: "Stablecoin float", measured: true, channel: "dollar_liquidity", col: 0 },
  { id: "spot_buying_power", label: "Spot buying power", measured: false, channel: "dollar_liquidity", col: 1 },
  { id: "dxy", label: "Broad dollar (DXY)", measured: true, channel: "macro_risk", col: 0 },
  { id: "real_yields", label: "Real yields", measured: false, channel: "macro_risk", col: 1 },
  { id: "risk_appetite", label: "Risk appetite", measured: false, channel: "macro_risk", col: 2 },
  { id: "market_depth", label: "Market depth", measured: true, channel: "liquidity_risk", col: 0 },
  { id: "gap_risk", label: "Gap risk", measured: false, channel: "liquidity_risk", col: 1 },
];

export const EDGES: GraphEdge[] = [
  { id: "funding_to_basis", src: "funding_rate", dst: "basis_trade", polarity: "positive", channel: "basis_arb", mechanism: "Elevated perp funding widens the perp-spot basis, improving the economics of the cash-and-carry basis trade and drawing arbitrage capital into it." },
  { id: "basis_to_funding", src: "basis_trade", dst: "funding_rate", polarity: "negative", channel: "basis_arb", mechanism: "As basis-trade capital shorts perps to harvest funding, that short pressure pushes funding back down toward neutral, a self-limiting loop." },
  { id: "basis_to_etf", src: "basis_trade", dst: "etf_arbitrage", polarity: "positive", channel: "basis_arb", mechanism: "A wide basis and creation spread make ETF create/redeem arbitrage attractive, linking the basis complex to ETF primary-market activity." },
  { id: "etf_to_basis", src: "etf_arbitrage", dst: "basis_trade", polarity: "positive", channel: "basis_arb", mechanism: "ETF creation and redemption move spot and futures, feeding back into the relative pricing the basis trade depends on." },
  { id: "stablecoin_float_to_spot_buying_power", src: "stablecoin_float", dst: "spot_buying_power", polarity: "positive", channel: "dollar_liquidity", mechanism: "Net new stablecoin issuance expands on-chain dry powder, increasing the capital available to bid spot markets." },
  { id: "dxy_to_risk_appetite", src: "dxy", dst: "risk_appetite", polarity: "negative", channel: "macro_risk", mechanism: "A stronger broad dollar tightens global financial conditions and typically coincides with reduced appetite for risk assets." },
  { id: "real_yields_to_risk_appetite", src: "real_yields", dst: "risk_appetite", polarity: "negative", channel: "macro_risk", mechanism: "Rising real yields lift the risk-free alternative and the discount rate, compressing appetite for risk assets including crypto." },
  { id: "market_depth_to_gap_risk", src: "market_depth", dst: "gap_risk", polarity: "negative", channel: "liquidity_risk", mechanism: "Thinner resting depth absorbs less flow, so a given order size moves price further, raising the risk of discontinuous gaps." },
];

/** The engine's pipeline, as the Method section walks it. `artifact` is the kind of
 *  thing that step leaves behind — shown as a specimen line, labeled as such. */
export const PIPELINE = [
  { n: "01", h: "Capture", p: "Articles and factor observations are hashed over their normalized text and appended. Nothing is ever updated or deleted; a correction is a new row. When it happened and when we learned it are separate columns.", artifact: "sha256 9f2c…e41a · observed 15:59:58Z · captured 16:00:03Z" },
  { n: "02", h: "Normalize", p: "Every stream is read against its own history (90 days, 365 days, everything), so a reading is a percentile, not a raw number. Fewer than thirty observations and it says insufficient history instead of guessing.", artifact: "funding_rate/binance/BTC · 365d · P94 · n=365 · true_pit" },
  { n: "03", h: "Join", p: "The curated mechanism graph records the documented channels between factors. Edges are directed, versioned and append-only; their strength is a curated prior and is always labeled as one.", artifact: "funding_to_basis · funding_rate →(+) basis_trade · graph-v1" },
  { n: "04", h: "Flag", p: "A divergence engine, arithmetic with no model, flags states that are historically extreme, documented relationships that have broken, and structural signatures: spot-led, leverage-led, fragile.", artifact: "extreme_state · market_depth · P07 ≤ 0.05 · fired" },
  { n: "05", h: "Narrate", p: "A model writes atomic claims over what the engine measured, each typed measured, mechanical or conjecture. It narrates the dots. It is never the one that finds them.", artifact: "{ basis: \"mechanical\", refs: [\"funding_to_basis\"] }" },
  { n: "06", h: "Verify", p: "Every number must resolve to a store row. Every mechanical claim must cite a real edge. Anything that reads as an instruction is removed. A claim that fails is dropped, never softened, and the record keeps the count.", artifact: "kept 4 · dropped 1 · unverified-number" },
] as const;
