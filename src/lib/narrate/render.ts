import type { Claim } from "./schema";

const DISCLAIMER =
  "This is an assessment of current market structure, not financial advice. Crypto is highly volatile and you can lose money.";

/** Assemble the surviving (verified, non-advisory) claims into a brief. */
export function renderBrief(brief: { headline?: string; claims: Claim[] }, opts: { surface: "market" | "token"; asset?: string; asOf: number }): string {
  const title = brief.headline ?? (opts.surface === "market" ? "Market State" : `Token briefing — ${opts.asset ?? ""}`.trim());
  const lines: string[] = [`## ${title}`, ""];

  const measured = brief.claims.filter((c) => c.basis !== "conjecture");
  const conjecture = brief.claims.filter((c) => c.basis === "conjecture");

  if (measured.length) lines.push(measured.map((c) => c.text.trim()).join(" "));
  if (conjecture.length) {
    lines.push("");
    for (const c of conjecture) lines.push(`Conjecture: ${c.text.trim()}`);
  }
  if (!measured.length && !conjecture.length) lines.push("Insufficient verified structure to report at this time.");

  lines.push("", `_As of ${new Date(opts.asOf).toISOString()}._`, "", `_${DISCLAIMER}_`);
  return lines.join("\n");
}
