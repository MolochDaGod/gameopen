import { describe, expect, it } from "vitest";
import {
  ensureBlockTypes,
  openMapToRealmsScene,
  parseAnyVoxelDocument,
  realmsSceneToOpenMap,
} from "./convert";
import type { OpenVoxelMap } from "./types";

describe("voxel-canonical convert", () => {
  it("migrates free-color blocks to terrain types", () => {
    const map: OpenVoxelMap = {
      version: 1,
      dungeon: false,
      blocks: [{ x: 0, y: 0, z: 0, shape: "block", color: 0x888888, rotation: 0 }],
      deployables: [],
    };
    const fixed = ensureBlockTypes(map);
    expect(fixed.blocks[0].type).toBe("stone");
    expect(fixed.version).toBeGreaterThanOrEqual(2);
  });

  it("round-trips open map through realms scene", () => {
    const map: OpenVoxelMap = {
      version: 2,
      dungeon: true,
      blocks: [
        { x: 1, y: 0, z: 2, shape: "block", color: 0x5d9e3f, rotation: 0, type: "grass" },
        { x: 1, y: 1, z: 2, shape: "block", color: 0x888888, rotation: 0, type: "stone" },
      ],
      deployables: [
        { id: "s1", kind: "start", x: 1, y: 2, z: 2, rotation: 0 },
        { id: "n1", kind: "npc", x: 3, y: 0, z: 3, rotation: 1, weapon: "sword", difficulty: "hard" },
      ],
    };
    const scene = openMapToRealmsScene(map);
    expect(scene.blockEdits).toHaveLength(2);
    expect(scene.blockEdits[0].type).toBe("grass");
    expect(scene.spawn).toEqual({ x: 1, y: 2, z: 2 });
    expect(scene.npcs).toHaveLength(1);

    const back = realmsSceneToOpenMap(scene);
    expect(back.blocks).toHaveLength(2);
    expect(back.blocks.find((b) => b.type === "grass")).toBeTruthy();
    expect(back.deployables.some((d) => d.kind === "start")).toBe(true);
    expect(back.dungeon).toBe(true);
  });

  it("parses interchange JSON", () => {
    const json = JSON.stringify({
      format: "grudge.voxel.interchange",
      open: {
        version: 2,
        dungeon: false,
        blocks: [{ x: 0, y: 0, z: 0, shape: "block", color: 1, rotation: 0, type: "dirt" }],
        deployables: [],
      },
    });
    const map = parseAnyVoxelDocument(json);
    expect(map?.blocks[0].type).toBe("dirt");
  });

  it("parses pure realms scene", () => {
    const json = JSON.stringify({
      version: 1,
      props: [],
      npcs: [],
      colliders: [],
      triggers: [],
      paths: [],
      blockEdits: [{ x: 0, y: 1, z: 0, type: "cat:alloy-frame" }],
      spawn: { x: 0, y: 2, z: 0 },
      map: null,
    });
    const map = parseAnyVoxelDocument(json);
    expect(map?.blocks[0].type).toBe("cat:alloy-frame");
    expect(map?.deployables.some((d) => d.kind === "start")).toBe(true);
  });
});
