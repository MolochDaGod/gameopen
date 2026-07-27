import { describe, expect, it } from "vitest";
import {
  VERBS,
  VERB_CATEGORY,
  verbLabel,
  humanizeClipId,
  previewClipLabel,
  resolvePreviewClipId,
  PREVIEW_VERB_KEYS,
} from "../ExplorerCharacter";

describe("clip library labels & categories", () => {
  it("every preview verb has a built-in category (none silently fall to 'Other')", () => {
    const uncategorized = VERBS.filter((v) => !(v in VERB_CATEGORY));
    expect(uncategorized).toEqual([]);
  });

  it("humanizeClipId drops paths, splits camelCase/digits, and Title-Cases", () => {
    expect(humanizeClipId("animations/sword/outward-slash")).toBe("Outward Slash");
    expect(humanizeClipId("jumpAttack")).toBe("Jump Attack");
    expect(humanizeClipId("meleeCombo1")).toBe("Melee Combo 1");
    expect(humanizeClipId("blockReactWide")).toBe("Block React Wide");
  });

  it("verbLabel applies overrides for acronyms / awkward verbs, humanises the rest", () => {
    expect(verbLabel("mmaKick")).toBe("MMA Kick");
    expect(verbLabel("kipUp")).toBe("Kip-Up");
    expect(verbLabel("gestureRelievedSigh")).toBe("Relieved Sigh");
    expect(verbLabel("pistolWhip")).toBe("Pistol Whip");
  });

  it("labels every verb to a non-empty string", () => {
    for (const v of VERBS) expect(verbLabel(v).length).toBeGreaterThan(0);
  });

  it("previewClipLabel names the motion that actually plays (not the abstract verb)", () => {
    // Sword skill is Dual Weapon Combo — must not still read "Skill".
    expect(previewClipLabel("skill", "sword")).toBe("Dual Weapon Combo");
    expect(resolvePreviewClipId("skill", "sword")).toBe("animations/knife/dual-weapon-combo");
    // Jump previews jump-up takeoff, not falling-idle.
    expect(PREVIEW_VERB_KEYS.jump).toBe("jumpUp");
    expect(resolvePreviewClipId("jump", "sword")).toBe("animations/extra/jump-up");
    expect(previewClipLabel("jump", "sword")).toBe("Jump Up");
    // Roll is a dodge clip, not a roll clip — label must say so.
    expect(previewClipLabel("roll", "sword")).toMatch(/Dodge/i);
  });

  it("every verb resolves to a motion label for the default sword loadout", () => {
    for (const v of VERBS) {
      expect(previewClipLabel(v, "sword").length).toBeGreaterThan(0);
      expect(resolvePreviewClipId(v, "sword")).toBeTruthy();
    }
  });
});
