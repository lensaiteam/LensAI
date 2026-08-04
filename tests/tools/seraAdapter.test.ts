import { describe, it, expect } from "vitest";
import { generateSeraTools } from "@/lib/tools/seraAdapter";
import { TOOLS } from "@/lib/tools/registry";

describe("SERA tool generator", () => {
  it("emits one Python module per registry tool", () => {
    const files = generateSeraTools();
    expect(files).toHaveLength(TOOLS.length);
    for (const t of TOOLS) {
      const f = files.find((x) => x.path === `lensai_${t.name}.py`)!;
      expect(f).toBeTruthy();
      expect(f.content).toContain(`def ${t.name}(`);
      expect(f.content).toContain(t.description); // docstring drives SERA's router
      expect(f.content).toContain('"method": "tools/call"');
      expect(f.content).toContain(`"name": "${t.name}"`);
    }
  });

  it("orders required params before optional (valid Python signatures)", () => {
    const f = generateSeraTools().find((x) => x.path === "lensai_get_token_factor_state.py")!;
    expect(f.content).toMatch(/def get_token_factor_state\(asset: str, asOf: float = None\)/);
  });

  it("wires env-driven endpoint + bearer token", () => {
    const f = generateSeraTools()[0];
    expect(f.content).toContain('os.environ["LENSAI_TOOLS_URL"]');
    expect(f.content).toContain('os.environ.get("SERA_TOOLS_TOKEN"');
  });
});
