import type { WeaponGroup } from "../types";

/**
 * A single Play-mode combat skill slot: an input binding, label for the HUD,
 * the {@link EditorScene.playVfx} id it fires, and a cooldown in seconds
 * (0 = instant / no cooldown, used for the primary attack). The set a character
 * gets is chosen from its equipped-weapon group (or, for a Playground grudge
 * character, from its animation pack) so the skill bar always reads as "weapon
 * skills" for whatever is in hand.
 *
 * Icons come from the assets CDN (`iconUrl`) or the missing marker. No emoji
 * and no stand-in art. Whirlwind is listed in wowNamesAwaiting.ts until
 * Jonathan provides a new name.
 */
export interface PlaySkill {
  /** Stable slot key: "primary" (LMB) or "skill1".."skill5" (Digit1-5). */
  key: string;
  /** Short input hint shown on the slot (e.g. "LMB", "1"). */
  bind: string;
  /** Skill name shown under the slot. */
  label: string;
  /**
   * CDN icon URL. Empty / omitted → the HUD shows the missing marker.
   * Never an emoji glyph.
   */
  iconUrl?: string | null;
  /** @deprecated Empty. HUD uses iconUrl or the missing marker, never emoji. */
  glyph?: string;
  /** The playVfx id this slot triggers. */
  vfx: string;
  /** Cooldown in seconds; 0 means it can be spammed (the primary). */
  cooldown: number;
}

/** Build the canonical 6-slot kit (primary + skill1..5) from raw tuples. */
function kit(
  primary: [string, string],
  rest: [string, string, number][],
): PlaySkill[] {
  const skills: PlaySkill[] = [
    { key: "primary", bind: "LMB", label: primary[0], vfx: primary[1], cooldown: 0, iconUrl: null },
  ];
  rest.forEach(([label, vfx, cd], i) => {
    skills.push({ key: `skill${i + 1}`, bind: `${i + 1}`, label, vfx, cooldown: cd, iconUrl: null });
  });
  return skills;
}

const KITS: Record<WeaponGroup, PlaySkill[]> = {
  unarmed: kit(
    ["Strike", "slashArc"],
    [
      ["Shockwave", "shockwave", 4],
      ["Uppercut", "impactExplode", 5],
      ["Stomp", "aoeBlast", 8],
      ["Flurry", "burst", 6],
      ["Smoke", "smokePop", 10],
    ],
  ),
  "melee-1h": kit(
    ["Slash", "slashArc"],
    [
      ["Cleave", "shockwave", 4],
      ["Whirlwind", "nova", 6],
      ["Lunge", "impactExplode", 5],
      ["Shatter", "aoeBlast", 8],
      ["Sword Rain", "swordVolley", 12],
    ],
  ),
  "melee-2h": kit(
    ["Heavy Swing", "slashArc"],
    [
      ["Earthbreaker", "shockwave", 5],
      ["Ground Slam", "aoeBlast", 8],
      ["Dark Blades", "darkBlades", 10],
      ["Sword Rain", "swordVolley", 12],
      ["Meteor", "meteor", 16],
    ],
  ),
  "off-hand": kit(
    ["Jab", "slashArc"],
    [
      ["Bash", "shockwave", 4],
      ["Whirl", "nova", 6],
      ["Stun", "stunMark", 7],
      ["Shatter", "aoeBlast", 8],
      ["Smoke", "smokePop", 10],
    ],
  ),
  ranged: kit(
    ["Shot", "muzzle"],
    [
      ["Power Shot", "bulletTrail", 3],
      ["Volley", "swordVolley", 8],
      ["Turret", "turret", 14],
      ["Frag Shot", "fireBurst", 7],
      ["Arrow Rain", "meteor", 15],
    ],
  ),
  magic: kit(
    ["Bolt", "castSwirl"],
    [
      ["Nova", "nova", 4],
      ["Lightning", "lightning", 5],
      ["Flame", "flame", 6],
      ["Fire Dragon", "fireDragon", 12],
      ["Meteor", "meteor", 15],
    ],
  ),
};

/** The Play-mode skill kit for a given weapon group (defaults to unarmed). */
export function skillsForGroup(group: WeaponGroup): PlaySkill[] {
  return KITS[group] ?? KITS.unarmed;
}
