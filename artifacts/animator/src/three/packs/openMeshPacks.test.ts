import { describe, expect, it } from "vitest";
import { CAMP_ASSET_BINDINGS } from "../camp/campAssetCatalog";
import { getPlaceable } from "../camp/placeables";
import { DUNGEON_MAPS } from "../DungeonMaps";
import { OPEN_MESH_PACKS, packPieceById } from "./openMeshPacks";

describe("open mesh packs — wired into Open catalogs", () => {
  it("crypt and village maps keep SI and use pack files", () => {
    const crypt = packPieceById("mod-crypt");
    const village = packPieceById("vil-map");
    expect(crypt?.file).toBe(DUNGEON_MAPS["modular-crypt"].file);
    expect(village?.file).toBe(DUNGEON_MAPS["npc-village"].file);
    expect(DUNGEON_MAPS["modular-crypt"].keepSi).toBe(true);
    expect(DUNGEON_MAPS["npc-village"].keepSi).toBe(true);
  });

  it("every pack placeableId exists in camp bindings + CLAIM_PLACEABLES", () => {
    const placed = OPEN_MESH_PACKS.filter((p) => p.placeableId);
    expect(placed.length).toBeGreaterThan(8);
    for (const p of placed) {
      const id = p.placeableId!;
      expect(getPlaceable(id), `missing placeable ${id}`).toBeDefined();
      const bind = CAMP_ASSET_BINDINGS[id];
      expect(bind, `missing CAMP_ASSET_BINDINGS ${id}`).toBeDefined();
      expect(bind.meshKeys[0]).toBe(p.file);
      if (p.isolateNode) expect(bind.isolateNode).toBe(p.isolateNode);
    }
  });

  it("does not ship dungeon-essential as a fused public GLB", () => {
    expect(OPEN_MESH_PACKS.some((p) => p.file.includes("dungeon-essential"))).toBe(false);
  });
});
