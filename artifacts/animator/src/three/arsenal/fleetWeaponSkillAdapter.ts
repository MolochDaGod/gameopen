/**
 * Map Open T0 weapon kits → fleet `FleetWeaponSkill` rows.
 * Warlords / Voxel hosts can mirror this adapter for their loadout sources.
 */

import type { FleetWeaponSkill, FleetSlashVariantId } from "@workspace/epicfight";
import { scaffoldWeaponSkill, slashVariantForStage } from "@workspace/epicfight";
import type { T0SkillDef, T0WeaponKit } from "./t0WeaponSkills";
import { T0_WEAPON_KITS } from "./t0WeaponSkills";
import type { SkillKind } from "../types";

function kindToProjectile(kind: SkillKind): FleetWeaponSkill["projectile"] | undefined {
  if (kind === "slash" || kind === "thrust") {
    return {
      kind: "slash_wave",
      speed: 15,
      range: 8,
      slashVariant: "slashblue",
      contactRadius: 0.95,
      followWeapon: true,
      followDuration: 0.1,
    };
  }
  if (kind === "bolt" || kind === "muzzle") {
    return { kind: "bolt", speed: 22, range: 14 };
  }
  if (kind === "fireTornado" || kind === "fireDragon") {
    return { kind: "custom", speed: 11, range: 14, meshPath: "models/vfx/stylized-fire-tornado.glb" };
  }
  return undefined;
}

function kindToCollider(kind: SkillKind): FleetWeaponSkill["collider"] {
  if (kind === "nova" || kind === "slam") {
    return { type: "sphere", radius: 2.2, offset: [0, 0.2, 0] };
  }
  if (kind === "bolt" || kind === "laser") {
    return { type: "sphere", radius: 0.45, offset: [0, 1.1, 1.2] };
  }
  return { type: "capsule", radius: 0.45, halfHeight: 0.7, offset: [0, 1.0, 0.9] };
}

/** Samurai 2H clip roles (greatsword_samurai bake). */
const SAMURAI_2H_ANIM_ROLES = [
  "attack", // gs_samurai_combo_a
  "skill1", // gs_samurai_combo_b
  "skill2", // gs_samurai_dash_opener
  "skill3", // gs_samurai_teleport_strike
] as const;

const SAMURAI_SLASH_VARIANTS: FleetSlashVariantId[] = [
  "slashred",
  "slashyellow",
  "slashblue",
  "slashpurple",
];

/** Convert one T0 skill row into a production fleet skill. */
export function t0SkillToFleet(
  weaponId: string,
  slot: 0 | 1 | 2 | 3,
  skill: T0SkillDef,
): FleetWeaponSkill {
  const role = skill.role;
  const isSamurai2h =
    weaponId === "greatsword" ||
    weaponId === "greataxe" ||
    weaponId === "hammer2h" ||
    weaponId === "scythe" ||
    weaponId === "nodachi";

  const variant = (
    isSamurai2h
      ? SAMURAI_SLASH_VARIANTS[slot] ?? "slashred"
      : slashVariantForStage(slot, {
          finisher: role === "power",
          kind: role === "power" ? "finisher" : role === "special" ? "heavy" : undefined,
        })
  ) as FleetSlashVariantId;

  const projectile = kindToProjectile(skill.kind);
  if (projectile?.kind === "slash_wave") {
    projectile.slashVariant = variant;
    if (isSamurai2h) {
      projectile.speed = role === "power" ? 20 : role === "ranged" ? 18 : 15;
      projectile.range = role === "power" ? 12 : 9;
      projectile.contactRadius = 1.05;
    }
  }

  const animRole = isSamurai2h
    ? SAMURAI_2H_ANIM_ROLES[slot] ?? "attack"
    : "attack";

  return scaffoldWeaponSkill({
    id: `${weaponId}_slot${slot}_${skill.role}`,
    weaponId,
    slot,
    label: skill.label,
    role: skill.role,
    animRole,
    cooldown: skill.cooldown ?? 2.5,
    staminaCost: role === "power" ? 28 : role === "special" ? 20 : role === "ranged" ? 14 : 12,
    damage: role === "power" ? 48 : role === "special" ? 34 : role === "ranged" ? 30 : 26,
    force: role === "power" ? 3.5 : 2.2,
    castDuration: 0.2,
    activeDuration: isSamurai2h ? 0.32 : 0.25,
    collider: kindToCollider(skill.kind),
    castEffectId: isSamurai2h ? "getsuga_slash" : skill.kind,
    impactEffectId: skill.kind === "slash" || isSamurai2h ? "getsuga_slash" : skill.kind,
    projectile,
    aoeRadius: skill.kind === "nova" || skill.kind === "slam" ? 2.4 : undefined,
    iconUrl: skill.iconUrl,
    tags: [skill.role, skill.kind, ...(isSamurai2h ? ["samurai", "2h", "getsuga"] : [])],
    attachToHand: "main",
  });
}

/** Full 4-slot fleet kit for a weapon id. */
export function fleetSkillsForWeapon(weaponId: string): FleetWeaponSkill[] {
  const kit: T0WeaponKit | undefined = T0_WEAPON_KITS[weaponId] ?? T0_WEAPON_KITS.none;
  if (!kit) return [];
  return kit.skills.map((s, i) => t0SkillToFleet(kit.weaponId, i as 0 | 1 | 2 | 3, s));
}

/** All T0 kits as fleet skills (for readiness audit). */
export function allFleetT0Skills(): FleetWeaponSkill[] {
  const out: FleetWeaponSkill[] = [];
  for (const kit of Object.values(T0_WEAPON_KITS)) {
    out.push(...fleetSkillsForWeapon(kit.weaponId));
  }
  return out;
}
