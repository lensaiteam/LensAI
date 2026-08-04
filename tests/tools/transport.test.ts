import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { openDb, type DB } from "@/lib/capture/db/client";
import { runMigrations } from "@/lib/capture/db/migrate";
import { handleStdioLine, handleHttpRpc } from "@/lib/tools/transport";
import { checkBearer } from "@/lib/tools/auth";

let db: DB;
beforeEach(() => {
  db = openDb(":memory:");
  runMigrations(db);
});
afterEach(() => {
  db.close();
  delete process.env.SERA_TOOLS_TOKEN;
});

const listReq = JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" });

describe("stdio transport", () => {
  it("answers a JSONL request and ignores blank lines", () => {
    const out = handleStdioLine(db, listReq)!;
    expect((JSON.parse(out).result.tools as unknown[]).length).toBeGreaterThan(0);
    expect(handleStdioLine(db, "   ")).toBeNull();
  });
  it("returns a parse error for garbage", () => {
    expect(JSON.parse(handleStdioLine(db, "{not json")!).error.code).toBe(-32700);
  });
});

describe("http transport + auth", () => {
  it("denies when no token is configured (secure default)", () => {
    expect(handleHttpRpc(db, "Bearer whatever", listReq).status).toBe(401);
  });

  it("denies a wrong token, allows the right one", () => {
    process.env.SERA_TOOLS_TOKEN = "s3cret";
    expect(handleHttpRpc(db, "Bearer nope", listReq).status).toBe(401);
    const ok = handleHttpRpc(db, "Bearer s3cret", listReq);
    expect(ok.status).toBe(200);
    expect((ok.body as any).result.tools.length).toBeGreaterThan(0);
  });

  it("400s on invalid JSON (with a valid token)", () => {
    process.env.SERA_TOOLS_TOKEN = "s3cret";
    expect(handleHttpRpc(db, "Bearer s3cret", "{bad").status).toBe(400);
  });

  it("checkBearer parses the header form", () => {
    process.env.SERA_TOOLS_TOKEN = "abc";
    expect(checkBearer("Bearer abc")).toBe(true);
    expect(checkBearer("abc")).toBe(false);
    expect(checkBearer(undefined)).toBe(false);
  });
});
