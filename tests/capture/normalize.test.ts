import { describe, it, expect } from "vitest";
import { normalizeText, stripHtml } from "@/lib/capture/normalize";

describe("normalizeText", () => {
  it("strips tags and collapses whitespace", () => {
    expect(normalizeText("<p>Hello   <b>world</b></p>\n\n")).toBe("Hello world");
  });

  it("removes script and style content entirely", () => {
    expect(normalizeText("<style>.x{color:red}</style><p>Hi</p><script>alert(1)</script>")).toBe("Hi");
  });

  it("decodes named and numeric entities", () => {
    expect(normalizeText("A &amp; B &#39;q&#39; &#x2014;")).toBe("A & B 'q' —");
  });

  it("applies Unicode NFKC normalization", () => {
    // Fullwidth 'Ａ' (U+FF21) -> 'A' under NFKC.
    expect(normalizeText("ＡBC")).toBe("ABC");
  });

  it("is idempotent on realistic input", () => {
    const once = normalizeText("<div>BTC funding &amp; basis   spiked</div>");
    expect(once).toBe("BTC funding & basis spiked");
    expect(normalizeText(once)).toBe(once);
  });

  it("returns empty string for empty input", () => {
    expect(normalizeText("")).toBe("");
  });

  it("stripHtml leaves text with spaces where tags were", () => {
    expect(stripHtml("<a>x</a><a>y</a>").trim()).toBe("x  y");
  });
});
