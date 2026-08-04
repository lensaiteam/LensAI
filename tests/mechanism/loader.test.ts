import { describe, it, expect } from "vitest";
import { loadSeedFromText, parseSeed, contentChecksum } from "@/lib/mechanism/loader";

const VALID = `
version: test-v1
curator: test
nodes:
  - { id: stablecoin_float, label: "Stablecoin float", kind: factor, factor_stream: stablecoin_float }
  - { id: spot_buying_power, label: "Spot buying power", kind: concept }
edges:
  - id: sf_to_sbp
    src: stablecoin_float
    dst: spot_buying_power
    polarity: positive
    channel: dollar_liquidity
    mechanism: "Net new issuance expands dry powder available to bid spot."
    regimes_applies: [dollar_regime]
    lifecycle: documented
    strength: moderate
`;

describe("mechanism seed loader", () => {
  it("parses + validates a good seed and checksums it", () => {
    const { seed, checksum } = loadSeedFromText(VALID);
    expect(seed.version).toBe("test-v1");
    expect(seed.nodes).toHaveLength(2);
    expect(seed.edges[0].regimes_applies).toEqual(["dollar_regime"]);
    expect(checksum).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a dangling edge endpoint", () => {
    const bad = VALID.replace("dst: spot_buying_power", "dst: nonexistent_node");
    expect(() => parseSeed(bad)).toThrow(/not a node/);
  });

  it("rejects duplicate node ids", () => {
    const bad = VALID.replace(
      "  - { id: spot_buying_power, label: \"Spot buying power\", kind: concept }",
      "  - { id: stablecoin_float, label: \"Dup\", kind: concept }",
    );
    expect(() => parseSeed(bad)).toThrow(/duplicate node id/);
  });

  it("rejects an unknown factor_stream", () => {
    const bad = VALID.replace("factor_stream: stablecoin_float", "factor_stream: not_a_stream");
    expect(() => parseSeed(bad)).toThrow(/unknown factor_stream/);
  });

  it("rejects a factor node with no factor_stream", () => {
    const bad = `
version: t
curator: t
nodes:
  - { id: x, label: X, kind: factor }
edges: []
`;
    expect(() => parseSeed(bad)).toThrow(/must set factor_stream/);
  });

  it("rejects an unknown regime key", () => {
    const bad = VALID.replace("regimes_applies: [dollar_regime]", "regimes_applies: [made_up_regime]");
    expect(() => parseSeed(bad)).toThrow(/regime key/);
  });

  it("rejects advisory language in prose fields (guardrail over the seed)", () => {
    const bad = VALID.replace(
      'mechanism: "Net new issuance expands dry powder available to bid spot."',
      'mechanism: "When float rises you should buy spot immediately."',
    );
    expect(() => loadSeedFromText(bad)).toThrow(/non-advisory/);
  });

  it("checksum is version-independent but content-sensitive", () => {
    const a = loadSeedFromText(VALID).checksum;
    const bumped = loadSeedFromText(VALID.replace("version: test-v1", "version: test-v2")).checksum;
    const changed = loadSeedFromText(VALID.replace("positive", "negative")).checksum;
    expect(a).toBe(bumped); // same content, different version -> same checksum
    expect(a).not.toBe(changed);
  });
});
