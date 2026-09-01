import { describe, expect, it } from "vitest";
import { MAX_GLOW, MAX_RADIUS } from "./hudConfig";
import { parseUiKitExport, uiKitImportHasChanges } from "./uikitImport";

describe("parseUiKitExport", () => {
  it("rejects non-objects without throwing", () => {
    for (const bad of [null, 42, "x", [1]]) {
      const r = parseUiKitExport(bad);
      expect(uiKitImportHasChanges(r)).toBe(false);
      expect(r.notes.length).toBeGreaterThan(0);
    }
  });

  it("maps a full kit export: theme + --gk-* tokens", () => {
    const r = parseUiKitExport({
      theme: "cyberpunk",
      baseVars: { "--gk-accent": "#ff0044", "--gk-radius": "12px" },
      overrides: { "--gk-accent-2": "#00ffcc", "--gk-glow": 2 },
      fontScale: 1.1,
      frames: {},
    });
    expect(r.theme).toBe("cyberpunk");
    expect(r.appearance).toEqual({
      accent: "#ff0044",
      accent2: "#00ffcc",
      radius: 12,
      glow: 2,
    });
    expect(uiKitImportHasChanges(r)).toBe(true);
    expect(r.notes.join(" ")).toContain("frames");
  });

  it("overrides win over baseVars", () => {
    const r = parseUiKitExport({
      baseVars: { "--gk-accent": "#111111" },
      overrides: { "--gk-accent": "#222222" },
    });
    expect(r.appearance.accent).toBe("#222222");
  });

  it("maps unknown/alias theme names sensibly", () => {
    expect(parseUiKitExport({ theme: "military" }).theme).toBe("tactical");
    expect(parseUiKitExport({ theme: "dark" }).theme).toBe("abyss");
    expect(parseUiKitExport({ theme: "vaporwave" }).theme).toBeNull();
  });

  it("rejects hostile token values and clamps numerics", () => {
    const r = parseUiKitExport({
      overrides: {
        "--gk-accent": "url(javascript:alert(1))",
        "--gk-accent-2": "linear-gradient(red, blue)",
        "--gk-radius": "9999px",
        "--gk-glow": 999,
      },
    });
    expect(r.appearance.accent).toBeUndefined();
    expect(r.appearance.accent2).toBeUndefined();
    expect(r.appearance.radius).toBe(MAX_RADIUS);
    expect(r.appearance.glow).toBe(MAX_GLOW);
  });
});
