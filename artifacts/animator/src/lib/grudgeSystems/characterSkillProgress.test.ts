import { describe, expect, it } from "vitest";
import type { SkillNode, SkillTree } from "../../game/harvestCatalog";
import {
  activateNode,
  canActivateNode,
  computeEffectsFromUnlocks,
  defaultSkillProgress,
  domainForTreeId,
  effectsFromNode,
  ensureProgressSynced,
  grantFreeNodes,
  grantPointsForLevel,
  grantPointsForWeaponTier,
  grantPointsFromMasteryXp,
  mergeLegacyUnlocks,
  nodePointCost,
  normalizeSkillProgress,
} from "./characterSkillProgress";

const sampleTree: SkillTree = {
  id: "class-warrior",
  name: "Warrior",
  color: "#f00",
  nodes: [
    {
      id: "w_l0_warbound",
      name: "Warbound",
      desc: "L0 select",
      tier: 0,
      requires: [],
      cost: 1,
      requiredLevel: 0,
      auto: true,
      bonuses: { str: 2 },
    },
    {
      id: "w_ms_1",
      name: "Warrior Start",
      desc: "L1",
      tier: 0,
      requires: ["w_l0_warbound"],
      cost: 1,
      requiredLevel: 1,
      kind: "milestone",
      bonuses: { hp: 20 },
    },
    {
      id: "w_br_2",
      name: "Iron Skin",
      desc: "Bridge",
      tier: 1,
      requires: ["w_ms_1"],
      cost: 2,
      requiredLevel: 2,
      kind: "bridge",
      bonuses: { vit: 3, damagePct: 5 },
    },
  ],
};

describe("characterSkillProgress grant scheme", () => {
  it("grants starter + L1 milestone on first level", () => {
    const p = grantPointsForLevel(defaultSkillProgress(), 1);
    // starter class 1 + milestone class 1 = 2 class
    expect(p.points.class).toBe(2);
    // starter profession 1
    expect(p.points.profession).toBe(1);
    // milestone mastery 1 + camp 1
    expect(p.points.mastery).toBe(1);
    expect(p.points.camp).toBe(1);
    expect(p.grantedThroughLevel).toBe(1);
    expect(p.earned.class).toBe(2);
  });

  it("is idempotent for the same level", () => {
    const a = grantPointsForLevel(defaultSkillProgress(), 5);
    const b = grantPointsForLevel(a, 5);
    expect(b.points.class).toBe(a.points.class);
    expect(b.earned.class).toBe(a.earned.class);
    expect(b.grantedThroughLevel).toBe(5);
  });

  it("grants per-level and milestone bonuses through L5", () => {
    const p = grantPointsForLevel(defaultSkillProgress(), 5);
    // L1: starter class1 + ms class1 = 2
    // L2: +1 class
    // L3: +1
    // L4: +1
    // L5: +1 perLevel +1 milestone = +2
    // total class = 2+1+1+1+2 = 7
    expect(p.points.class).toBe(7);
    expect(p.grantedThroughLevel).toBe(5);
  });

  it("grants weapon tier points 0–5 once each", () => {
    let p = defaultSkillProgress();
    p = grantPointsForWeaponTier(p, "sword", 0);
    expect(p.points.weapon).toBe(1);
    p = grantPointsForWeaponTier(p, "sword", 2);
    // t1=2, t2=2 → +4 → total 5
    expect(p.points.weapon).toBe(5);
    p = grantPointsForWeaponTier(p, "sword", 2);
    expect(p.points.weapon).toBe(5); // no double
    p = grantPointsForWeaponTier(p, "axe", 0);
    expect(p.points.weapon).toBe(6); // other family
  });

  it("maps mastery XP tier to weapon grants", () => {
    const p = grantPointsFromMasteryXp(defaultSkillProgress(), "bow", 2000, () => 3);
    // mastery tier 3 → weapon tier 2 → t0+t1+t2 = 1+2+2 = 5
    expect(p.points.weapon).toBe(5);
    expect(p.weaponTierGranted.bow).toBe(2);
  });
});

describe("domainForTreeId", () => {
  it("maps class / weapon / profession / camp / mastery", () => {
    expect(domainForTreeId("class-warrior")).toBe("class");
    expect(domainForTreeId("weapon-combat")).toBe("weapon");
    expect(domainForTreeId("weapon-sword")).toBe("weapon");
    expect(domainForTreeId("harvest")).toBe("profession");
    expect(domainForTreeId("crafting")).toBe("profession");
    expect(domainForTreeId("camp_claim")).toBe("camp");
    expect(domainForTreeId("mastery_warrior")).toBe("mastery");
  });
});

describe("node activation + effects", () => {
  it("L0/auto nodes cost 0", () => {
    expect(nodePointCost(sampleTree.nodes[0]!)).toBe(0);
    expect(nodePointCost(sampleTree.nodes[1]!)).toBe(1);
    expect(nodePointCost(sampleTree.nodes[2]!)).toBe(2);
  });

  it("grants free L0 then spends points on paid nodes", () => {
    let p = grantPointsForLevel(defaultSkillProgress(), 5);
    p = grantFreeNodes(p, sampleTree);
    expect(p.unlocked).toContain("w_l0_warbound");

    const mid = activateNode(p, sampleTree.nodes[1]!, {
      playerLevel: 5,
      treeId: sampleTree.id,
      allNodes: sampleTree.nodes,
    });
    expect(mid.ok).toBe(true);
    if (!mid.ok) return;
    expect(mid.progress.unlocked).toContain("w_ms_1");
    expect(mid.progress.points.class).toBe(p.points.class - 1);
    expect(mid.progress.effects.maxHp).toBe(20);
    expect(mid.progress.effects.attrs.STR).toBe(2); // from free L0

    // Bridge needs 2 points
    const br = activateNode(mid.progress, sampleTree.nodes[2]!, {
      playerLevel: 5,
      treeId: sampleTree.id,
      allNodes: sampleTree.nodes,
    });
    expect(br.ok).toBe(true);
    if (!br.ok) return;
    expect(br.progress.effects.damagePct).toBe(5);
    expect(br.progress.effects.attrs.VIT).toBe(3);
  });

  it("blocks activation without points or level", () => {
    let p = defaultSkillProgress(); // 0 points, no grants
    p = grantFreeNodes(p, sampleTree);
    const fail = canActivateNode(p, sampleTree.nodes[1]!, {
      playerLevel: 1,
      treeId: sampleTree.id,
    });
    expect(fail.ok).toBe(false);
    expect(fail.reason).toMatch(/point/i);

    p = grantPointsForLevel(defaultSkillProgress(), 1);
    p = grantFreeNodes(p, sampleTree);
    // spend all class points
    p.points.class = 0;
    const fail2 = activateNode(p, sampleTree.nodes[1]!, {
      playerLevel: 1,
      treeId: sampleTree.id,
    });
    expect(fail2.ok).toBe(false);

    p = grantPointsForLevel(defaultSkillProgress(), 1);
    p = grantFreeNodes(p, sampleTree);
    const failLv = canActivateNode(p, sampleTree.nodes[2]!, {
      playerLevel: 1,
      treeId: sampleTree.id,
    });
    expect(failLv.ok).toBe(false);
    expect(failLv.reason).toMatch(/level/i);
  });

  it("imports effects from bonuses map", () => {
    const node: SkillNode = {
      id: "test",
      name: "T",
      desc: "",
      tier: 1,
      requires: [],
      cost: 1,
      formId: "bear",
      kind: "active",
      bonuses: { STR: 5, damagePct: 10, cdr: 15 },
    };
    const e = effectsFromNode(node);
    expect(e.attrs.STR).toBe(5);
    expect(e.damagePct).toBe(10);
    expect(e.cdMul).toBeLessThan(1);
    expect(e.grantedSkills).toContain("bear");
    expect(e.grantedSkills).toContain("test");
  });

  it("computeEffectsFromUnlocks rebuilds from catalog", () => {
    const e = computeEffectsFromUnlocks(
      ["w_l0_warbound", "w_ms_1"],
      sampleTree.nodes,
    );
    expect(e.maxHp).toBe(20);
    expect(e.attrs.STR).toBe(2);
  });
});

describe("ensure / migrate", () => {
  it("ensureProgressSynced grants level and free nodes", () => {
    const p = ensureProgressSynced(defaultSkillProgress(), 3, [sampleTree]);
    expect(p.grantedThroughLevel).toBe(3);
    expect(p.unlocked).toContain("w_l0_warbound");
    expect(p.points.class).toBeGreaterThan(0);
  });

  it("mergeLegacyUnlocks merges without spend", () => {
    const p = mergeLegacyUnlocks(defaultSkillProgress(), ["legacy_a", "w_l0_warbound"], sampleTree.nodes);
    expect(p.unlocked).toContain("legacy_a");
    expect(p.unlocked).toContain("w_l0_warbound");
  });

  it("normalizeSkillProgress repairs bad payloads", () => {
    const p = normalizeSkillProgress({
      points: { class: -3 } as never,
      unlocked: ["a", "a", 1 as never],
    });
    expect(p.version).toBe(1);
    expect(p.points.class).toBe(0);
    expect(p.unlocked).toEqual(["a"]);
  });
});
