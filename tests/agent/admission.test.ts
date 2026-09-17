import { describe, it, expect } from "vitest";
import { runAdmission } from "@/lib/agent/llm/admission";
import { MockJsonLlm, type JsonRequest } from "@/lib/agent/llm/types";

const REF = "pctl:funding_rate/binance/BTC/365d";

function competent(req: JsonRequest): unknown {
  if (req.system.includes("You route a user's question")) {
    return req.user.includes("savings") ? { intent: "advice", assets: ["ETH"], focus: null, since_hours: null } : { intent: "token", assets: ["BTC"], focus: "funding vs open interest", since_hours: null };
  }
  if (req.system.includes("plain-language market WATCH")) {
    return req.user.includes("150,000")
      ? { ok: false, reason: "Price levels are not something the desk watches." }
      : { ok: true, rule: { all: [{ type: "percentile", stream: "funding_rate", asset: "BTC", op: "gte", value: 0.95 }, { type: "percentile", stream: "basis", asset: "BTC", op: "lte", value: 0.6 }] } };
  }
  return {
    headline: "BTC",
    claims: [
      { text: "BTC funding sits at the 97th percentile of its 365-day history.", basis: "measured", refs: [REF], numbers: [{ value: 97, unit: "percentile", ref: REF }] },
      { text: "Elevated funding widens the carry spread via the documented channel.", basis: "mechanical", refs: ["funding_to_basis"], numbers: [] },
      { text: "Basis has not yet followed funding higher.", basis: "conjecture", refs: [], numbers: [] },
    ],
  };
}

describe("model admission", () => {
  it("a competent model passes every case through the real code paths", async () => {
    const results = await runAdmission(new MockJsonLlm(competent));
    expect(results.map((r) => [r.name, r.pass])).toEqual(results.map((r) => [r.name, true]));
    expect(results).toHaveLength(5);
  });

  it("a model that invents numbers and gives advice is rejected", async () => {
    const sloppy = (req: JsonRequest) =>
      req.tier === "small"
        ? { intent: "market", assets: [], focus: null, since_hours: null }
        : { claims: [{ text: "Funding is at the 55th percentile.", basis: "measured", refs: [], numbers: [{ value: 55 }] }, { text: "You should buy BTC now.", basis: "conjecture", refs: [], numbers: [] }] };
    const results = await runAdmission(new MockJsonLlm(sloppy));
    expect(results.filter((r) => !r.pass).length).toBeGreaterThanOrEqual(4);
  });
});
