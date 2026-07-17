/**
 * Guard: never re-introduce run-to-roll as grudge6 run/sprint.
 */
import { describe, expect, it } from "vitest";
import {
  ANIM_PACK_CLIPS,
  BANNED_LOCOMOTION_CLIPS,
  isBannedLocomotionClip,
  SPRINT_CLIP,
} from "./anims";

describe("grudge6 locomotion pack SSOT", () => {
  it("bans run-to-roll and bad sprint uploads", () => {
    expect(isBannedLocomotionClip("locomotion/running")).toBe(true);
    expect(isBannedLocomotionClip("uploads_2026_06/locomotion/running")).toBe(true);
    expect(isBannedLocomotionClip("uploads/locomotion/Quick_Roll_To_Run")).toBe(true);
    expect(isBannedLocomotionClip("magic/Standing Run Forward")).toBe(false);
    expect(isBannedLocomotionClip("uploads_2026_06/locomotion/torch run forward")).toBe(false);
  });

  it("no pack run/walk points at banned clips", () => {
    for (const [pack, clips] of Object.entries(ANIM_PACK_CLIPS)) {
      expect(isBannedLocomotionClip(clips.run), `${pack}.run`).toBe(false);
      expect(isBannedLocomotionClip(clips.walk), `${pack}.walk`).toBe(false);
      // Legacy SPRINT_CLIP constant is banned — must not be used as pack run
      expect(clips.run).not.toBe(SPRINT_CLIP);
      expect(clips.run).not.toBe("locomotion/running");
      expect(clips.run).not.toBe("uploads_2026_06/locomotion/running");
    }
  });

  it("uses torch run forward for unarmed (arena parity)", () => {
    expect(ANIM_PACK_CLIPS.unarmed.run).toBe(
      "uploads_2026_06/locomotion/torch run forward",
    );
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
    }
  });

  it("banned list documents known bad files", () => {
    expect(BANNED_LOCOMOTION_CLIPS).toContain("locomotion/running");
  });
});
