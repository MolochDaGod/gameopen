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

/** Convert one T0 skill row into a production fleet skill. */
export function t0SkillToFleet(
  weaponId: string,
  slot: 0 | 1 | 2 | 3,
  skill: T0SkillDef,
): FleetWeaponSkill {
  const role = skill.role;
  const variant = slashVariantForStage(slot, {
    finisher: role === "power",
    kind: role === "power" ? "finisher" : role === "special" ? "heavy" : undefined,
  }) as FleetSlashVariantId;

  const projectile = kindToProjectile(skill.kind);
  if (projectile?.kind === "slash_wave") {
    projectile.slashVariant = variant;
  }

  return scaffoldWeaponSkill({
    id: `${weaponId}_slot${slot}_${skill.role}`,
    weaponId,
    slot,
    label: skill.label,
    role: skill.role,
    animRole: "attack",
    cooldown: skill.cooldown ?? 2.5,
    staminaCost: role === "power" ? 28 : role === "special" ? 20 : role === "ranged" ? 14 : 12,
    damage: role === "power" ? 42 : role === "special" ? 28 : 18,
    force: role === "power" ? 3 : 2,
    castDuration: 0.2,
    activeDuration: 0.25,
    collider: kindToCollider(skill.kind),
    castEffectId: skill.kind,
    impactEffectId: skill.kind === "slash" ? "getsuga_slash" : skill.kind,
    projectile,
    aoeRadius: skill.kind === "nova" || skill.kind === "slam" ? 2.4 : undefined,
    iconUrl: skill.iconUrl,
    tags: [skill.role, skill.kind],
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
