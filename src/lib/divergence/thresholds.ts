import { DAY } from "../factors/windows";

/** Divergence-engine parameters. All are stamped on every derived row (params +
 *  code_version) so a flag is reproducible and self-describing. Bump the version
 *  when the arithmetic changes. */
export const DIVERGENCE_CODE_VERSION = "div-v1";

// Extreme-state: a percentile at/above HIGH or at/below LOW is "historically extreme".
export const EXTREME_HIGH = 0.95;
export const EXTREME_LOW = 0.05;
/** The window whose percentile drives extreme-state flags. */
export const EXTREME_WINDOW = "365d";

// Broken-relationship: lookback for a factor's recent direction (co-movement).
export const COMOVE_LOOKBACK_MS = 30 * DAY;

// Structural signatures (curated v1 rules).
export const SIGNATURE_RULE_VERSION = "sig-v1";
/** Open-interest percentile counted as "elevated" for leverage-led. */
export const OI_ELEVATED = 0.7;
/** Open-interest percentile counted as "not elevated" for spot-led. */
export const OI_CALM = 0.5;
/** Funding percentile counted as "stretched" for fragile. */
export const FUNDING_STRETCHED = 0.9;
