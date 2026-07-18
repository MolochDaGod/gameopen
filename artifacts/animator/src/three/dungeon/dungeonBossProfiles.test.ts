import { describe, expect, it } from "vitest";
import {
  DUNGEON_BOSS_PROFILES,
  DUNGEON_MAP_BOSS,
  bossAsPrefab,
  bossProfileForMap,
  bossScaledDamage,
  getDungeonBossProfile,
  meshIdsForBoss,
} from "./dungeonBossProfiles";

describe("dungeonBossProfiles — grudge6 player-like bosses", () => {
  it("catalog has forge-moloch and no karate-boss ids", () => {
    expect(DUNGEON_BOSS_PROFILES["forge-moloch"]).toBeDefined();
    expect(DUNGEON_BOSS_PROFILES["elite-ironclad"]).toBeDefined();
    for (const id of Object.keys(DUNGEON_BOSS_PROFILES)) {
      expect(id).not.toMatch(/karate/i);
    }
  });

  it("maps default dungeon to forge-moloch orc knight greataxe T5", () => {
    const p = bossProfileForMap("default");
    expect(p.id).toBe("forge-moloch");
    expect(p.raceId).toBe("orcs");
    expect(p.presetId).toBe("knight");
    expect(p.weaponId).toBe("greataxe");
    expect(p.weaponTier).toBe(5);
    expect(p.level).toBeGreaterThanOrEqual(18);
    expect(p.skillLabels).toHaveLength(4);
    expect(p.attributes.strength).toBeGreaterThan(50);
  });

  it("maps chicken-gun-town to elite-ironclad", () => {
    expect(DUNGEON_MAP_BOSS["chicken-gun-town"]).toBe("elite-ironclad");
    const p = bossProfileForMap("chicken-gun-town");
    expect(p.raceId).toBe("dwarves");
    expect(p.weaponTier).toBe(3);
  });

  it("builds EntityPrefab with combat + mesh ids from gear preset", () => {
    const p = getDungeonBossProfile("forge-moloch");
    const prefab = bossAsPrefab(p);
    expect(prefab.kind).toBe("hostile");
    expect(prefab.weaponId).toBe("greataxe");
    expect(prefab.maxHp).toBe(p.maxHp);
    expect(prefab.combat.damage).toBe(p.attackDamage);
    const meshes = meshIdsForBoss(p);
    expect(meshes.length).toBeGreaterThan(0);
  });

  it("scales skill damage above basic attack (weapon tier + attrs)", () => {
    const p = getDungeonBossProfile("forge-moloch");
    const basic = bossScaledDamage(p, false);
    const skill = bossScaledDamage(p, true);
    expect(skill).toBeGreaterThan(basic);
    expect(basic).toBeGreaterThan(p.attackDamage);
  });

  it("every profile has level, tier, skill tree, ai, and player-like attrs", () => {
    for (const p of Object.values(DUNGEON_BOSS_PROFILES)) {
      expect(p.level).toBeGreaterThan(0);
      expect(p.weaponTier).toBeGreaterThanOrEqual(0);
      expect(p.weaponTier).toBeLessThanOrEqual(5);
      expect(p.skillTreeNodes.length).toBeGreaterThan(0);
      expect(p.skillLabels.length).toBe(4);
      expect(p.ai).toMatch(/melee_pressure|ranged_kite|caster_burst|hybrid_elite/);
      expect(p.attributes.vitality).toBeGreaterThan(0);
      expect(p.maxHp).toBeGreaterThan(100);
    }
  });
});
