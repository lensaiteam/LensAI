import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, type DB } from "@/lib/capture/db/client";
import { runMigrations } from "@/lib/capture/db/migrate";
import { createDal } from "@/lib/capture/db/dal";
import { normalizeAll } from "@/lib/factors/normalize";
import { computeRegimes } from "@/lib/factors/regimes";
import { runDivergence } from "@/lib/divergence/engine";
import { loadSeedFromFile } from "@/lib/mechanism/loader";
import { loadGraph } from "@/lib/mechanism/graph";
import { handleRpc } from "@/lib/tools/rpc";
import { TOOLS } from "@/lib/tools/registry";
import { DAY } from "@/lib/factors/windows";

let db: DB;
const ANCHOR = 399 * DAY;

beforeEach(() => {
  db = openDb(":memory:");
  runMigrations(db);
  const dal = createDal(db);
  for (let i = 0; i < 400; i++) {
    dal.insertObservation({ stream: "funding_rate", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: i, observedAt: i * DAY }, i * DAY);
    dal.insertObservation({ stream: "open_interest", source: "binance", asset: "BTC", instrument: "BTCUSDT", value: i * 10, observedAt: i * DAY }, i * DAY);
  }
  dal.insertArticle({ source: "coindesk", url: "https://x/1", title: "BTC funding hits a high", extractedText: "Bitcoin perp funding surged." }, ANCHOR - 1000);
  dal.insertArticle({ source: "theblock", url: "https://x/2", title: "Later news", extractedText: "captured after the anchor" }, ANCHOR + 1_000_000);
  normalizeAll(db, { asOf: ANCHOR, slot: ANCHOR });
  computeRegimes(db, { asOf: ANCHOR, slot: ANCHOR });
  runDivergence(db, { asOf: ANCHOR, slot: ANCHOR });
  loadGraph(db, loadSeedFromFile(), 1000);
});
afterEach(() => db.close());

// Call a tool through the RPC layer and parse the MCP content payload.
function call(name: string, args: Record<string, unknown> = {}): { payload: any; isError: boolean } {
  const res = handleRpc(db, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } });
  const result = res.result as { content: { text: string }[]; isError?: boolean };
  return { payload: JSON.parse(result.content[0].text), isError: !!result.isError };
}

describe("MCP dispatcher", () => {
  it("initialize returns server info", () => {
    const r = handleRpc(db, { jsonrpc: "2.0", id: 1, method: "initialize" });
    expect((r.result as any).serverInfo.name).toBe("lensai-tools");
  });

  it("tools/list advertises every tool with a description + schema", () => {
    const r = handleRpc(db, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    const tools = (r.result as any).tools as { name: string; description: string; inputSchema: unknown }[];
    expect(tools).toHaveLength(TOOLS.length);
    for (const t of tools) {
      expect(t.description.length).toBeGreaterThan(20);
      expect(t.inputSchema).toBeTruthy();
    }
  });

  it("unknown method -> JSON-RPC error", () => {
    expect(handleRpc(db, { jsonrpc: "2.0", id: 1, method: "nope" }).error?.code).toBe(-32601);
  });

  it("unknown tool -> JSON-RPC error", () => {
    expect(handleRpc(db, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "ghost" } }).error?.code).toBe(-32602);
  });

  it("invalid arguments -> isError tool result (not a protocol error)", () => {
    const { isError, payload } = call("get_token_factor_state", {}); // missing asset
    expect(isError).toBe(true);
    expect(payload.error).toMatch(/invalid arguments/);
  });
});

describe("tool handlers (point-in-time)", () => {
  it("get_market_state returns regimes + fired flags at the resolved anchor", () => {
    const { payload } = call("get_market_state", { asOf: ANCHOR + 5000 });
    expect(payload.as_of).toBe(ANCHOR);
    expect(payload.regimes.some((r: any) => r.regime_key === "funding_regime" && r.asset === "BTC")).toBe(true);
    expect(payload.note).toMatch(/not advice/i);
  });

  it("get_token_factor_state returns per-window percentiles + vintage", () => {
    const { payload } = call("get_token_factor_state", { asset: "BTC", asOf: ANCHOR });
    const f365 = payload.percentiles.find((p: any) => p.stream === "funding_rate" && p.window_id === "365d");
    expect(f365.percentile).toBe(1);
    expect(f365.vintage).toBe("true_pit");
  });

  it("get_divergences returns fired extreme_state for BTC funding", () => {
    const { payload } = call("get_divergences", { asOf: ANCHOR, kind: "extreme_state", asset: "BTC" });
    expect(payload.flags.some((f: any) => f.subject === "funding_rate/binance/BTC")).toBe(true);
  });

  it("get_mechanism filters by channel and labels strength as a prior", () => {
    const { payload } = call("get_mechanism", { channel: "dollar_liquidity" });
    expect(payload.edges).toHaveLength(1);
    expect(payload.edges[0].strength_note).toMatch(/prior/);
  });

  it("get_factor_series returns the resolved series", () => {
    const { payload } = call("get_factor_series", { stream: "funding_rate", asset: "BTC", asOf: ANCHOR, limit: 10 });
    expect(payload.points).toHaveLength(10);
    expect(payload.points.at(-1).value).toBe(399);
  });

  it("search_corpus is point-in-time and matches by asset", () => {
    const { payload } = call("search_corpus", { asset: "BTC", asOf: ANCHOR });
    expect(payload.count).toBe(1); // the later-captured article is invisible at ANCHOR
    expect(payload.articles[0].url).toBe("https://x/1");
    expect(payload.articles[0].content_hash).toBeTruthy();
  });

  it("get_claims returns an empty set (no extraction yet)", () => {
    expect(call("get_claims", { asOf: ANCHOR }).payload.count).toBe(0);
  });

  it("market_state before any compute reports no state", () => {
    const { payload } = call("get_market_state", { asOf: 1 });
    expect(payload.as_of).toBeNull();
  });
});
