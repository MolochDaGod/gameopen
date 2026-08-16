import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BACK_SLOT_ITEMS, backUseLegend, codedBackSlotItems } from "./backSlotItems";

type Catalog = {
  prefabs: Array<{
    id: string;
    itemId: string;
    runtimeId: string;
    useKind: string;
    useKey: string | null;
    status: string;
  }>;
};

const catalog = JSON.parse(
  readFileSync(resolve(process.cwd(), "../../content/backs/catalog.json"), "utf8"),
) as Catalog;

describe("Back slot prefabs", () => {
  it("catalog runtime ids cover every coded backSlotItems row", () => {
    const byRuntime = new Map(catalog.prefabs.map((p) => [p.runtimeId, p]));
    for (const item of codedBackSlotItems()) {
      const prefab = byRuntime.get(item.id);
      expect(prefab, item.id).toBeTruthy();
      expect(prefab!.id).toBe(item.prefabId);
      expect(prefab!.useKind).toBe(item.useKind);
    }
  });

  it("hotkey items use Space; deploy documents E get-off; never invent combat R", () => {
    for (const p of catalog.prefabs) {
      if (p.useKind === "hotkey") expect(p.useKey).toBe("Space");
      if (p.useKind === "passive") expect(p.useKey).toBeNull();
      if (p.useKind === "deploy") expect(p.useKey).toBe("Space");
    }
    const wind = catalog.prefabs.find((p) => p.runtimeId === "back_wind_surf");
    expect(wind?.useKind).toBe("deploy");
    expect(BACK_SLOT_ITEMS.some((i) => i.useKey === "R")).toBe(false);
  });

  it("backUseLegend prints PASSIVE or the existing key", () => {
    const fin = BACK_SLOT_ITEMS.find((i) => i.id === "back_shark_fin")!;
    expect(backUseLegend(fin).startsWith("PASSIVE")).toBe(true);
    const holy = BACK_SLOT_ITEMS.find((i) => i.id === "back_holy_wings")!;
    expect(backUseLegend(holy).startsWith("Space")).toBe(true);
  });

  it("every prefab has a bck_ file and an itm_back_ bag template", () => {
    for (const p of catalog.prefabs) {
      expect(readFileSync(resolve(process.cwd(), `../../content/backs/${p.id}.json`), "utf8")).toContain(p.runtimeId);
      expect(readFileSync(resolve(process.cwd(), `../../content/items/${p.itemId}.json`), "utf8")).toContain("\"kind\": \"back\"");
    }
  });
});
