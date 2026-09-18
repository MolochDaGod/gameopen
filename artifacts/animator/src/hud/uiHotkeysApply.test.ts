import { describe, expect, it } from "vitest";
import { parseUiHotkeysExport } from "./uiHotkeysApply";

describe("parseUiHotkeysExport", () => {
  it("reads bindings array", () => {
    const r = parseUiHotkeysExport({
      packId: "danger",
      bindings: [
        { action: "Attack", keys: "LMB" },
        { action: "Skill 1", key: "1", category: "Skills" },
      ],
    });
    expect(r.packId).toBe("danger");
    expect(r.bindings).toEqual([
      { action: "Attack", keys: "LMB", category: undefined },
      { action: "Skill 1", keys: "1", category: "Skills" },
    ]);
  });

  it("reads actions map", () => {
    const r = parseUiHotkeysExport({ actions: { move: "WASD", jump: "Space" } });
    expect(r.bindings.map((b) => b.action).sort()).toEqual(["jump", "move"]);
  });

  it("rejects junk", () => {
    expect(parseUiHotkeysExport(null).bindings).toEqual([]);
    expect(parseUiHotkeysExport("x").bindings).toEqual([]);
  });
});
