import { describe, expect, it } from "vitest";
import {
  dangerRoomLocation,
  dungeonLocation,
  formatLocation,
  samePlace,
} from "./location";

describe("location", () => {
  it("builds danger room home", () => {
    const loc = dangerRoomLocation();
    expect(loc.kind).toBe("danger-room");
    expect(loc.zoneId).toBe("danger");
    expect(loc.instanceId.startsWith("inst_")).toBe(true);
  });

  it("nests dungeon under parent", () => {
    const home = dangerRoomLocation({ instanceId: "inst_home" });
    const d = dungeonLocation({
      mapId: "minecraft-kit",
      parent: home,
      instanceId: "inst_d1",
    });
    expect(d.kind).toBe("dungeon");
    expect(d.parent?.instanceId).toBe("inst_home");
    expect(formatLocation(d)).toContain("dungeon");
  });

  it("samePlace ignores position", () => {
    const a = dangerRoomLocation({ instanceId: "inst_a" });
    const b = { ...a, position: { x: 9, y: 0, z: 9 } };
    expect(samePlace(a, b)).toBe(true);
  });
});
