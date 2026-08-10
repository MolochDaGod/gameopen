import { describe, expect, it } from "vitest";
import {
  defaultSpineForFamily,
  primaryCombatPointId,
  resolveSpinePoint,
  resolveWeaponSpine,
  spinePointForVfxAnchor,
} from "./weaponPrefabSpine";

describe("weaponPrefabSpine", () => {
  it("gives sword tip above blade in SI metres", () => {
    const s = defaultSpineForFamily("sword");
    expect(s.align).toBe("y");
    expect(s.points.tip!.pos[1]).toBeGreaterThan(s.points.blade!.pos[1]);
    expect(s.points.tip!.pos[1]).toBeLessThan(2.5);
  });

  it("guns use barrel on Z and primary combat barrel", () => {
    const s = defaultSpineForFamily("gun");
    expect(s.align).toBe("z");
    expect(s.points.barrel).toBeTruthy();
    expect(primaryCombatPointId("gun")).toBe("barrel");
    expect(primaryCombatPointId("staff")).toBe("cast");
    expect(primaryCombatPointId("mace")).toBe("blunt");
    expect(primaryCombatPointId("sword")).toBe("tip");
  });

  it("merges prefab override over family default", () => {
    const r = resolveWeaponSpine({
      family: "sword",
      spine: {
        forward: "y+",
        align: "y",
        status: "ready",
        points: { tip: { pos: [0, 1.5, 0] } },
      },
    });
    expect(r.points.tip!.pos[1]).toBe(1.5);
    expect(r.points.blade).toBeTruthy(); // kept from default
    expect(r.status).toBe("ready");
  });

  it("maps vfx anchors to spine ids", () => {
    expect(spinePointForVfxAnchor("weaponTip")).toBe("tip");
    expect(spinePointForVfxAnchor("muzzle")).toBe("barrel");
    expect(spinePointForVfxAnchor("cast")).toBe("cast");
    expect(spinePointForVfxAnchor("blunt")).toBe("blunt");
  });

  it("resolveSpinePoint falls back sensibly", () => {
    const tip = resolveSpinePoint({ family: "staff" }, "tip");
    const cast = resolveSpinePoint({ family: "staff" }, "cast");
    expect(cast.pos[1]).toBeGreaterThan(0.5);
    expect(tip.pos[1]).toBe(cast.pos[1]);
  });
});
