/**
 * CastingAbilities → Grudge Warlords / Danger weapon-skill migration SSOT.
 *
 * Source product: Moloch CastingAbilitiesThreeJS (path cast + 4 elements + beauty VFX).
 * Target shape: fleet SkillPack / FleetWeaponSkill (cast / travel / impact + magic anim).
 *
 * Do not re-implement path-draw combat in Warlords — map phases to bolt/beam/nova
 * while reusing the same effect ids and magic Bip001 cast clips.
 *
 * @see CastingAbilities src/vfx/vfxCatalog.js ELEMENT_EFFECT_MAP
 * @see docs/CANONICAL_COMBAT.md FleetWeaponSkill
 * @see arsenal/magic.ts staff* weapons
 */

/** Local SkillPack shape (avoid circular runtime import from weaponSkillPacks). */
export type SkillPack = {
  animKey: string;
  slot: 1 | 2 | 3 | 4;
  label: string;
  clipPath: string;
  animRole?: string;
  bakedRole?: string;
  reach: number;
  damage: number;
  lungeSpeed: number;
  lungeDuration: number;
  vfxColor: number;
  cooldown: number;
  effectKind?: "impact" | "slash" | "slashWave" | "getsuga" | "nova" | "slam" | "chain";
  slashVariant?: "slashred" | "slashblue" | "slashpurple" | "slashyellow";
  impactEffectId?: string;
  castEffectId?: string;
  projectile?: "none" | "slash_wave" | "bolt" | "arrow" | "hellfire_chain";
  chainPathRole?: string;
  useDash?: boolean;
};

/** Casting sandbox element keys. */
export type CastingElement = "fire" | "water" | "earth" | "wind" | "arcane";

/**
 * Phase map from Casting Ability lifecycle → fleet skill VFX fields.
 * Casting: TRAVEL along path · IMPACT at end · cast tell on hand.
 * Warlords: castEffectId · projectile (travel) · impactEffectId.
 */
export type ElementPhaseVfx = {
  element: CastingElement;
  /** Hand / charge tell */
  cast: string;
  /** Travel / path head (projectile or path shader id) */
  travel: string;
  /** End explode / splash */
  impact: string;
  /** UI / trail hex */
  color: number;
  /** Fleet projectile kind */
  projectile: NonNullable<SkillPack["projectile"]>;
  /** Combat VFX kind for host */
  effectKind: NonNullable<SkillPack["effectKind"]>;
  /** Magic pack clip (Bip001 baked) */
  castClip: string;
  /** Anim role on director */
  animRole: string;
  /** Warlords staff weapon id (arsenal) */
  staffWeaponId: string;
};

/** Casting element → cast / travel / impact (shared effect id vocabulary). */
export const CASTING_ELEMENT_PHASE_VFX: Record<CastingElement, ElementPhaseVfx> = {
  fire: {
    element: "fire",
    cast: "fire_hand",
    travel: "fireball",
    impact: "inferno",
    color: 0xff6a1e,
    projectile: "bolt",
    effectKind: "nova",
    castClip: "anims/baked/magic/standing 1h cast spell 01.json",
    animRole: "cast",
    staffWeaponId: "staffFire",
  },
  water: {
    element: "water",
    cast: "arcane_swirl",
    travel: "moon_beam",
    impact: "frost_wave",
    color: 0x5fd6ff,
    projectile: "bolt",
    effectKind: "nova",
    castClip: "anims/baked/magic/standing 1h cast spell 01.json",
    animRole: "cast",
    staffWeaponId: "staffIce",
  },
  earth: {
    element: "earth",
    cast: "earth_surge",
    travel: "earth_surge",
    impact: "earth_surge",
    color: 0xc4a574,
    projectile: "bolt",
    effectKind: "slam",
    castClip: "anims/baked/magic/standing 1h cast spell 01.json",
    animRole: "cast",
    staffWeaponId: "staffNature",
  },
  wind: {
    element: "wind",
    cast: "arcane_swirl",
    travel: "chain_lightning",
    impact: "ice_lightning_burst",
    color: 0x9fdcff,
    projectile: "bolt",
    effectKind: "nova",
    castClip: "anims/baked/magic/standing 1h cast spell 01.json",
    animRole: "cast",
    staffWeaponId: "staffStorm",
  },
  /** Purple explosive + wind-like shaders (new Warlords arcane tree). */
  arcane: {
    element: "arcane",
    cast: "arcane_swirl",
    travel: "chain_lightning",
    impact: "inferno",
    color: 0xb070ff,
    projectile: "bolt",
    effectKind: "nova",
    castClip: "anims/baked/magic/standing 1h cast spell 01.json",
    animRole: "cast",
    staffWeaponId: "staff",
  },
};

function elementalHotbar(el: CastingElement, labels: [string, string, string, string]): SkillPack[] {
  const v = CASTING_ELEMENT_PHASE_VFX[el];
  const reaches: [number, number, number, number] = [14, 10, 16, 8];
  const damages: [number, number, number, number] = [22, 35, 48, 65];
  const cds: [number, number, number, number] = [0, 3.0, 6.0, 12.0];
  const clips: [string, string, string, string] = [
    v.castClip,
    "anims/baked/magic/staffattack.json",
    v.castClip,
    "anims/baked/magic/staffattack.json",
  ];
  const roles: [string, string, string, string] = ["cast", "attack", "cast", "cast"];
  const kinds: Array<SkillPack["effectKind"]> = ["nova", v.effectKind, "nova", "nova"];

  return ([1, 2, 3, 4] as const).map((slot, i) => ({
    animKey: `${el}_skill_${slot}`,
    slot,
    label: labels[i]!,
    clipPath: clips[i]!,
    animRole: roles[i]!,
    bakedRole: roles[i]!,
    reach: reaches[i]!,
    damage: damages[i]!,
    lungeSpeed: 0,
    lungeDuration: 0,
    vfxColor: v.color,
    cooldown: cds[i]!,
    effectKind: kinds[i]!,
    castEffectId: v.cast,
    impactEffectId: v.impact,
    projectile: v.projectile,
  }));
}

/** Fire staff — Casting fire path + Warlords staffFire. */
export const STAFF_FIRE_SKILLS: readonly SkillPack[] = elementalHotbar("fire", [
  "Fire Bolt",
  "Flame Wave",
  "Meteor Path",
  "Inferno",
]);

/** Water / frost — Casting water path + staffIce. */
export const STAFF_WATER_SKILLS: readonly SkillPack[] = elementalHotbar("water", [
  "Water Lash",
  "Frost Wave",
  "Moon Beam",
  "Blizzard Shell",
]);

/** Earth — Casting earth path + staffNature. */
export const STAFF_EARTH_SKILLS: readonly SkillPack[] = elementalHotbar("earth", [
  "Earth Spike",
  "Quake Surge",
  "Stone Path",
  "Tectonic Burst",
]);

/** Wind — Casting wind + staffStorm (lightning/wind shaders). */
export const STAFF_WIND_SKILLS: readonly SkillPack[] = elementalHotbar("wind", [
  "Wind Bolt",
  "Gale Nova",
  "Chain Storm",
  "Tempest",
]);

/**
 * Arcane skill tree (purple + explosive + wind-like).
 * Primary Warlords staff / Arcane Staff tree — maps Casting arcane + purple slash.
 */
export const STAFF_ARCANE_SKILLS: readonly SkillPack[] = [
  {
    animKey: "arcane_bolt",
    slot: 1,
    label: "Arcane Bolt",
    clipPath: "anims/baked/magic/standing 1h cast spell 01.json",
    animRole: "cast",
    bakedRole: "cast",
    reach: 14,
    damage: 24,
    lungeSpeed: 0,
    lungeDuration: 0,
    vfxColor: 0xb070ff,
    cooldown: 0,
    effectKind: "nova",
    castEffectId: "arcane_swirl",
    impactEffectId: "arcane_swirl",
    projectile: "bolt",
  },
  {
    animKey: "arcane_gale",
    slot: 2,
    label: "Arcane Gale",
    clipPath: "anims/baked/magic/staffattack.json",
    animRole: "attack",
    bakedRole: "attack",
    reach: 12,
    damage: 38,
    lungeSpeed: 0,
    lungeDuration: 0,
    vfxColor: 0x9a6bff,
    cooldown: 3.0,
    effectKind: "nova",
    castEffectId: "arcane_swirl",
    impactEffectId: "ice_lightning_burst",
    projectile: "bolt",
  },
  {
    animKey: "void_burst",
    slot: 3,
    label: "Void Burst",
    clipPath: "anims/baked/magic/standing 1h cast spell 01.json",
    animRole: "cast",
    bakedRole: "cast",
    reach: 10,
    damage: 52,
    lungeSpeed: 0,
    lungeDuration: 0,
    vfxColor: 0x8844ff,
    cooldown: 6.0,
    effectKind: "nova",
    castEffectId: "arcane_swirl",
    impactEffectId: "inferno",
    projectile: "bolt",
    slashVariant: "slashpurple",
  },
  {
    animKey: "storm_arcane",
    slot: 4,
    label: "Storm Arcane",
    clipPath: "anims/baked/magic/staffattack.json",
    animRole: "cast",
    bakedRole: "cast",
    reach: 16,
    damage: 70,
    lungeSpeed: 0,
    lungeDuration: 0,
    vfxColor: 0x6600ff,
    cooldown: 12.0,
    effectKind: "nova",
    castEffectId: "chain_lightning",
    impactEffectId: "inferno",
    projectile: "bolt",
    slashVariant: "slashpurple",
  },
] as const;

/** Replace default MAGIC_SKILLS with Casting-aligned arcane tree. */
export const MAGIC_SKILLS_FROM_CASTING = STAFF_ARCANE_SKILLS;

export function skillPackForStaffWeaponId(weaponId: string): readonly SkillPack[] {
  const w = weaponId.toLowerCase();
  if (w === "stafffire" || w === "staff_fire") return STAFF_FIRE_SKILLS;
  if (w === "staffice" || w === "staff_ice") return STAFF_WATER_SKILLS;
  if (w === "staffnature" || w === "staff_nature") return STAFF_EARTH_SKILLS;
  if (w === "staffstorm" || w === "staff_storm") return STAFF_WIND_SKILLS;
  if (w === "staffholy" || w === "staff_holy") return STAFF_ARCANE_SKILLS;
  if (w === "staff" || w === "wand" || w === "tome") return STAFF_ARCANE_SKILLS;
  return STAFF_ARCANE_SKILLS;
}

/** Export rows for epicfight scaffoldWeaponSkill hosts. */
export function castingElementToFleetRows(
  element: CastingElement,
  weaponId: string,
): Array<{
  id: string;
  weaponId: string;
  slot: 0 | 1 | 2 | 3;
  label: string;
  animRole: string;
  animClip: string;
  castEffectId: string;
  impactEffectId: string;
  trailColor: number;
  cooldown: number;
  castDuration: number;
  staminaCost: number;
  damage: number;
  projectile: { kind: "bolt"; speed: number; range: number };
  aoeRadius?: number;
  tags: string[];
}> {
  const pack =
    element === "fire"
      ? STAFF_FIRE_SKILLS
      : element === "water"
        ? STAFF_WATER_SKILLS
        : element === "earth"
          ? STAFF_EARTH_SKILLS
          : element === "wind"
            ? STAFF_WIND_SKILLS
            : STAFF_ARCANE_SKILLS;
  const phase = CASTING_ELEMENT_PHASE_VFX[element];
  return pack.map((s, i) => ({
    id: `${weaponId}_${s.animKey}`,
    weaponId,
    slot: (i as 0 | 1 | 2 | 3),
    label: s.label,
    animRole: s.animRole || "cast",
    animClip: s.clipPath,
    castEffectId: s.castEffectId || phase.cast,
    impactEffectId: s.impactEffectId || phase.impact,
    trailColor: s.vfxColor,
    cooldown: s.cooldown,
    castDuration: 0.45 + i * 0.1,
    staminaCost: 10 + i * 4,
    damage: s.damage,
    projectile: {
      kind: "bolt" as const,
      speed: 18 + i * 2,
      range: s.reach,
    },
    aoeRadius: i >= 2 ? 2.5 + i * 0.5 : undefined,
    tags: ["casting-migrate", element, "staff", "magic"],
  }));
}
