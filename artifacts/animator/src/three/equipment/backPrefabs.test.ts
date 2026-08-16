import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BACK_SLOT_ITEMS, backUseLegend, codedBackSlotItems, backItemIconUrl } from "./backSlotItems";
import { getItemTemplate, isLedgerUniqueItem } from "../../game/inventory/catalog";

type Catalog = {
  prefabs: Array<{
    id: string;
    itemId: string;
    runtimeId: string;
    recipeId?: string | null;
    icon?: { status?: string; cdnUrl?: string };
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

  it("bag templates are unique back gear with CDN icons", () => {
    expect(isLedgerUniqueItem("itm_back_holy_wings")).toBe(true);
    const t = getItemTemplate("itm_back_holy_wings");
    expect(t.kind).toBe("back");
    expect(t.equipSlot).toBe("back");
    expect(t.maxStack).toBe(1);
    expect(backItemIconUrl("itm_back_holy_wings")).toContain("Naturecircle.png");
  });

  it("backUseLegend prints PASSIVE or the existing key", () => {
    const fin = BACK_SLOT_ITEMS.find((i) => i.id === "back_shark_fin")!;
    expect(backUseLegend(fin).startsWith("PASSIVE")).toBe(true);
    const holy = BACK_SLOT_ITEMS.find((i) => i.id === "back_holy_wings")!;
    expect(backUseLegend(holy).startsWith("Space")).toBe(true);
  });

  it("every coded prefab has a harvest recipe and a ready pack icon", () => {
    const recipes = JSON.parse(
      readFileSync(resolve(process.cwd(), "../../content/harvest/recipes.json"), "utf8"),
    ) as { recipes: Array<{ id: string; output: { id: string } }> };
    const byOut = new Map(recipes.recipes.map((r) => [r.output.id, r.id]));
    for (const p of catalog.prefabs) {
      expect(byOut.get(p.itemId), p.itemId).toBe(p.recipeId);
      expect(p.icon?.status).toBe("ready");
      expect(p.icon?.cdnUrl).toMatch(/^https:\/\/assets\.grudge-studio\.com\/icons\/pack\//);
    }
  });

  it("every prefab has a bck_ file and an itm_back_ bag template", () => {
    for (const p of catalog.prefabs) {
      expect(readFileSync(resolve(process.cwd(), `../../content/backs/${p.id}.json`), "utf8")).toContain(p.runtimeId);
      expect(readFileSync(resolve(process.cwd(), `../../content/items/${p.itemId}.json`), "utf8")).toContain("\"kind\": \"back\"");
    }
  });
});
