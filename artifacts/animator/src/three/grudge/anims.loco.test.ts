/**
 * Guard: never re-introduce run-to-roll as grudge6 run/sprint.
 */
import { describe, expect, it } from "vitest";
import {
  ANIM_PACK_CLIPS,
  BANNED_LOCOMOTION_CLIPS,
  TRAVERSAL_CLIPS,
  MOBILITY_CLIPS,
  NEVER_ALIAS_TO_ATTACK,
  isBannedLocomotionClip,
  isBadLocoClipName,
  isFakeSprintName,
  SPRINT_CLIP,
} from "./anims";

describe("grudge6 locomotion pack SSOT", () => {
  it("bans run-to-roll and bad sprint uploads", () => {
    expect(isBannedLocomotionClip("locomotion/running")).toBe(true);
    expect(isBannedLocomotionClip("uploads_2026_06/locomotion/running")).toBe(true);
    expect(isBannedLocomotionClip("uploads/locomotion/Quick_Roll_To_Run")).toBe(true);
    expect(isBannedLocomotionClip("magic/Standing Run Forward")).toBe(false);
    expect(isBannedLocomotionClip("uploads_2026_06/locomotion/torch run forward")).toBe(false);
    expect(isBadLocoClipName("Running Roll")).toBe(true);
    expect(isBadLocoClipName("roll-running")).toBe(true);
    expect(isBadLocoClipName("Standing Run Forward")).toBe(false);
  });

  it("no pack run/walk points at banned clips", () => {
    for (const [pack, clips] of Object.entries(ANIM_PACK_CLIPS)) {
      expect(isBannedLocomotionClip(clips.run), `${pack}.run`).toBe(false);
      expect(isBannedLocomotionClip(clips.walk), `${pack}.walk`).toBe(false);
      // Legacy SPRINT_CLIP constant is banned — must not be used as pack run
      expect(clips.run).not.toBe(SPRINT_CLIP);
      expect(clips.run).not.toBe("locomotion/running");
      expect(clips.run).not.toBe("uploads_2026_06/locomotion/running");
      // No Madarame full-take dumps as gait
      expect(clips.run).not.toBe("polearm/run");
      expect(clips.walk).not.toBe("polearm/walk");
    }
  });

  it("polearm uses standing walk + locomotion/run_forward (not 5s full takes)", () => {
    expect(ANIM_PACK_CLIPS.polearm.walk).toBe("magic/Standing Walk Forward");
    expect(ANIM_PACK_CLIPS.polearm.run).toBe("locomotion/run_forward");
  });

  it("samurai pack uses greatsword_samurai sword stance (1H + 2H SSOT)", () => {
    expect(ANIM_PACK_CLIPS.samurai).toBeTruthy();
    expect(ANIM_PACK_CLIPS.samurai.attack).toBe("greatsword_samurai/gs_samurai_combo_a");
    expect(ANIM_PACK_CLIPS.samurai.run).toContain("gs_samurai_run");
    expect(ANIM_PACK_CLIPS.samurai.idle).toContain("gs_samurai_idle");
    expect(ANIM_PACK_CLIPS.samurai.extras?.length).toBeGreaterThan(6);
    expect(ANIM_PACK_CLIPS.samurai.extras).toContain("ghost_rider/quakesmash");
  });

  it("1H sword_shield uses samurai sword clips not thin arena run", () => {
    expect(ANIM_PACK_CLIPS.sword_shield.idle).toContain("gs_samurai_idle_sword");
    expect(ANIM_PACK_CLIPS.sword_shield.attack).toContain("gs_samurai_combo");
    expect(ANIM_PACK_CLIPS.sword_shield.run).not.toBe("sword_shield/sword and shield run");
    expect(isBannedLocomotionClip("sword_shield/sword and shield run")).toBe(true);
    expect(ANIM_PACK_CLIPS.sword_shield.extras).toContain("dual_wield/sword_dash_attack");
    expect(ANIM_PACK_CLIPS.sword_shield.extras).toContain("ghost_rider/quakesmash");
  });

  it("unarmed uses locomotion/run_forward cycle", () => {
    expect(ANIM_PACK_CLIPS.unarmed.run).toBe("locomotion/run_forward");
  });

  it("includes polearm pack for spear/2H (Madarame bake)", () => {
    expect(ANIM_PACK_CLIPS.polearm).toBeTruthy();
    expect(ANIM_PACK_CLIPS.polearm.attack).toBe("polearm/attack");
    expect(ANIM_PACK_CLIPS.polearm.extras?.length).toBeGreaterThan(4);
  });

  it("uses standing forward walks (not generic locomotion/walking tip)", () => {
    // Generic locomotion/walking tips Arena GLB kits; packs use forward cycles.
    for (const clips of Object.values(ANIM_PACK_CLIPS)) {
      expect(clips.walk).not.toBe("locomotion/walking");
      expect(isBannedLocomotionClip(clips.walk)).toBe(false);
    }
  });

  it("banned list documents known bad files", () => {
    expect(BANNED_LOCOMOTION_CLIPS).toContain("locomotion/running");
    expect(BANNED_LOCOMOTION_CLIPS).toContain("locomotion/walking");
    expect(isBannedLocomotionClip("locomotion/walking")).toBe(true);
  });

  it("no pack run is a roll transition path", () => {
    for (const [pack, clips] of Object.entries(ANIM_PACK_CLIPS)) {
      expect(clips.run.toLowerCase()).not.toMatch(/roll/);
      expect(clips.run).not.toMatch(/running$/i);
      expect(pack).toBeTruthy();
    }
  });

  it("ships traversal clips for jump + AA/DD dodge for every hero", () => {
    expect(TRAVERSAL_CLIPS.length).toBeGreaterThanOrEqual(8);
    const roles = new Set(TRAVERSAL_CLIPS.map((t) => t.role));
    expect(roles.has("jump")).toBe(true);
    expect(roles.has("dodgeL")).toBe(true);
    expect(roles.has("dodgeR")).toBe(true);
    expect(roles.has("dodgeF")).toBe(true);
    for (const t of TRAVERSAL_CLIPS) {
      // Never map mobility to banned tip/roll loco paths
      if (t.role.startsWith("dodge") || t.role.includes("jump")) {
        expect(isBannedLocomotionClip(t.rel)).toBe(false);
      }
    }
  });

  it("includes mobility roles crawl/climb/swim for controller surfaces", () => {
    const roles = new Set(MOBILITY_CLIPS.map((m) => m.role));
    expect(roles.has("crawl")).toBe(true);
    expect(roles.has("swim")).toBe(true);
    expect(roles.has("climb")).toBe(true);
    expect(roles.has("mantle")).toBe(true);
    for (const m of MOBILITY_CLIPS) {
      expect(m.mixamoRel.startsWith("anim/")).toBe(true);
      expect(m.bakeRel.length).toBeGreaterThan(3);
    }
  });

  it("never aliases mobility/defense onto attack", () => {
    for (const r of ["jump", "dodge", "sprint", "crawl", "swim", "climb", "hurt", "block"]) {
      expect(NEVER_ALIAS_TO_ATTACK.has(r)).toBe(true);
    }
    expect(NEVER_ALIAS_TO_ATTACK.has("skill1")).toBe(false);
  });

  it("treats locomotion/running as fake sprint (run-to-roll)", () => {
    expect(isFakeSprintName("locomotion/running")).toBe(true);
    expect(isFakeSprintName("uploads_2026_06/locomotion/torch run forward")).toBe(false);
  });
});
