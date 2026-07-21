import { describe, expect, it } from "vitest";
import {
  AI_WORLD_PATTERNS,
  AI_WORLD_TRAINING_PROMPT,
  gateWorldNode,
  isProductionTestContext,
  productionWorldReport,
  TERRAIN_RULES,
  WATER_RULES,
} from "./productionWorldRules";
import { HELLMAW_WORLD_NODES, type WorldMeshNode } from "./worldMeshDeploy";

describe("productionWorldRules", () => {
  it("defines SI terrain / water / AI patterns for playable worlds", () => {
    expect(TERRAIN_RULES.metersPerUnit).toBe(1);
    expect(TERRAIN_RULES.humanHeightM).toBe(1.8);
    expect(TERRAIN_RULES.stepHeightM).toBeLessThanOrEqual(0.5);
    expect(WATER_RULES.minDepthM).toBeGreaterThan(0);
    expect(WATER_RULES.layer).toBe("Water");
    expect(AI_WORLD_PATTERNS.bossArenaClearRadiusM).toBeGreaterThanOrEqual(10);
    expect(AI_WORLD_PATTERNS.minCorridorWidthM).toBeGreaterThanOrEqual(2);
    expect(AI_WORLD_PATTERNS.minSpawnSeparationM).toBeGreaterThanOrEqual(2);
  });

  it("gates all Hellmaw production nodes to pass", () => {
    const report = productionWorldReport();
    expect(report.allPass).toBe(true);
    expect(report.nodes.length).toBe(HELLMAW_WORLD_NODES.length);
    expect(report.surface).toContain("open.grudge-studio.com");
    for (const row of report.nodes) {
      expect(row.pass, `${row.id} fails: ${row.fails.join("; ")}`).toBe(true);
    }
  });

  it("rejects world boss on home/plains without allow-gate", () => {
    const bad: WorldMeshNode = {
      id: "bad_boss_home",
      meshKey: "models/bosses/shadow-flame-mantis.prod.glb",
      kind: "world_boss",
      position: [0, 0, 0],
      sizeHintM: 3.2,
      physicsLayer: "NPC",
      collider: { kind: "capsule", params: [0.9, 2.4] },
      location: { archetype: "home", tags: ["home"] },
      runtime: { bossId: "shadow_flame_mantis" },
    };
    const gates = gateWorldNode(bad);
    const allow = gates.find((g) => g.id === "allow_gate");
    expect(allow?.ok).toBe(false);
  });

  it("rejects localhost-only as production QA sign-off", () => {
    expect(isProductionTestContext({ href: "http://localhost:5173" }).ok).toBe(false);
    expect(
      isProductionTestContext({
        href: "https://open.grudge-studio.com/play",
        cdnVerified: true,
      }).ok,
    ).toBe(true);
  });

  it("exports AI training prompt with yardstick + production host", () => {
    expect(AI_WORLD_TRAINING_PROMPT).toContain("1.8");
    expect(AI_WORLD_TRAINING_PROMPT).toContain("open.grudge-studio.com");
    expect(AI_WORLD_TRAINING_PROMPT).toMatch(/Terrain|Water|NPC/i);
  });
});
