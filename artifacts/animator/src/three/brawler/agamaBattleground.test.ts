import { describe, expect, it } from "vitest";
import {
  AGAMA_MIN_SPAN_M,
  buildAgamaLayout,
  createCombatMemory,
  decideAgamaMapScale,
  hasLineOfSight,
  hostileToward,
  inAgroRange,
  rememberDamageTaken,
  rememberHitLanded,
  shouldLeash,
  zoneAt,
} from "./agamaBattleground";

describe("decideAgamaMapScale", () => {
  it("does not apply a second 0.01 when FBX cm child is already present", () => {
    const d = decideAgamaMapScale(
      { spanXZ: 1940, height: 28, hasFbxCmChild: true, doorHeight: 1.76 },
      true,
    );
    expect(d.unitScale).toBe(1);
    expect(d.playScale).toBe(1);
    expect(d.padToSpan).toBeGreaterThanOrEqual(1940);
    expect(d.reason).toMatch(/fbx/i);
  });

  it("never shrinks a kilometre battleground to a 90 m pad", () => {
    const d = decideAgamaMapScale(
      { spanXZ: 1600, height: 22, hasFbxCmChild: true },
      true,
    );
    expect(d.playScale).toBe(1);
    expect(d.unitScale * 1600).toBeGreaterThan(400);
  });

  it("pads tiny fallback maps up to the battleground floor", () => {
    const d = decideAgamaMapScale(
      { spanXZ: 40, height: 8, hasFbxCmChild: false, doorHeight: 2.1 },
      true,
    );
    expect(d.unitScale).toBe(1);
    expect(d.padToSpan).toBeGreaterThanOrEqual(AGAMA_MIN_SPAN_M);
  });

  it("converts cm-authored maps without an FBX child", () => {
    const d = decideAgamaMapScale(
      { spanXZ: 18000, height: 900, hasFbxCmChild: false, doorHeight: 176 },
      true,
    );
    expect(d.unitScale).toBe(0.01);
    expect(d.playScale).toBe(1);
  });
});

describe("LOS / aggro / leash", () => {
  it("blocks LOS through a fat occluder", () => {
    const los = hasLineOfSight({ x: 0, z: 0 }, { x: 20, z: 0 }, [{ x: 10, z: 0, r: 2 }]);
    expect(los).toBe(false);
  });

  it("allows LOS past offset occluders", () => {
    const los = hasLineOfSight({ x: 0, z: 0 }, { x: 20, z: 0 }, [{ x: 10, z: 8, r: 1.5 }]);
    expect(los).toBe(true);
  });

  it("aggros on hearing even without LOS", () => {
    expect(inAgroRange({ x: 0, z: 0 }, { x: 8, z: 0 }, false)).toBe(true);
    expect(inAgroRange({ x: 0, z: 0 }, { x: 40, z: 0 }, false)).toBe(false);
    expect(inAgroRange({ x: 0, z: 0 }, { x: 30, z: 0 }, true)).toBe(true);
  });

  it("leashes when pulled too far from home", () => {
    expect(shouldLeash({ x: 80, z: 0 }, { x: 0, z: 0 }, true)).toBe(true);
    expect(shouldLeash({ x: 10, z: 0 }, { x: 0, z: 0 }, true)).toBe(false);
  });
});

describe("combat memory", () => {
  it("spaces out after skill damage and dodges more", () => {
    const mem = createCombatMemory(1.8);
    const next = rememberDamageTaken(mem, { x: 1, z: 0 }, 2.2, true);
    expect(next.hitsTaken).toBe(1);
    expect(next.dodgeBias).toBeGreaterThan(mem.dodgeBias);
    expect(next.preferredRange).toBeGreaterThan(mem.preferredRange);
  });

  it("presses skills after landing hits", () => {
    let mem = createCombatMemory(1.8);
    mem = rememberHitLanded(mem, true);
    mem = rememberHitLanded(mem, true);
    expect(mem.hitsLanded).toBe(2);
    expect(mem.skillWeight).toBeGreaterThan(0.2);
  });
});

describe("layout + factions", () => {
  it("builds farms, war camps, harvest, and a north extraction", () => {
    const layout = buildAgamaLayout(280, { x: 0, z: -180 });
    const kinds = new Set(layout.zones.map((z) => z.kind));
    expect(kinds.has("farm")).toBe(true);
    expect(kinds.has("war")).toBe(true);
    expect(kinds.has("extract")).toBe(true);
    expect(kinds.has("safe")).toBe(true);
    expect(layout.extract.z).toBeGreaterThan(layout.spawn.z);
    expect(layout.harvest.length).toBeGreaterThan(20);
    const atSpawn = zoneAt(layout.zones, layout.spawn.x, layout.spawn.z);
    expect(atSpawn?.kind).toBe("safe");
  });

  it("treats orc vs ally as hostile and player vs ally as friendly", () => {
    expect(hostileToward("orc", "ally")).toBe(true);
    expect(hostileToward("player", "ally")).toBe(false);
    expect(hostileToward("crusade", "orc")).toBe(true);
  });
});
