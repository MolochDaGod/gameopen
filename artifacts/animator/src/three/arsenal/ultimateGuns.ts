/**
 * Poly Pizza Ultimate Guns Pack — mesh + drop + ammo SSOT for fleet GUN class.
 *
 * Assets: public/models/weapons/ultimate-guns/*.glb
 * Catalog: public/models/weapons/ultimate-guns/catalog.json
 * Preview: https://static.poly.pizza/listimg/CkWIv7GwRfo6uopKE33h.webp
 *
 * Extends {@link gunClass} / {@link gunCombat} — does not invent a second combat system.
 * TPS feel (Arc Raiders-like): hip fire + ADS, reserve ammo, world loot drops.
 */
import type { WeaponId } from "../types";
import type { GunLoadout } from "../gunCombat";
import type { GunFamilyId } from "./gunClass";
import { GUN_FAMILIES } from "./gunClass";

export type AmmoTypeId = "light" | "medium" | "heavy" | "shell";

export interface UltimateGunDef {
  id: string;
  file: string;
  /** Path under public/ */
  modelFile: string;
  family: GunFamilyId;
  weaponId: WeaponId;
  label: string;
  ammo: AmmoTypeId;
  dropWeight: number;
  reserveDefault: number;
  /** FOV multiplier while ADS (1 = no change) */
  adsFovMul: number;
  hipSpread: number;
  adsSpread: number;
  loadoutOverride?: Partial<GunLoadout>;
}

const ROOT = "models/weapons/ultimate-guns";

/** Canonical pack weapons (clean GLB names). */
export const ULTIMATE_GUNS: UltimateGunDef[] = [
  {
    id: "ug_pistol",
    file: "pistol.glb",
    modelFile: `${ROOT}/pistol.glb`,
    family: "pistol",
    weaponId: "pistol",
    label: "Pistol",
    ammo: "light",
    dropWeight: 1.2,
    reserveDefault: 45,
    adsFovMul: 0.92,
    hipSpread: 0.04,
    adsSpread: 0.012,
  },
  {
    id: "ug_revolver",
    file: "revolver.glb",
    modelFile: `${ROOT}/revolver.glb`,
    family: "pistol",
    weaponId: "pistol",
    label: "Revolver",
    ammo: "light",
    dropWeight: 1.0,
    reserveDefault: 30,
    adsFovMul: 0.9,
    hipSpread: 0.05,
    adsSpread: 0.01,
  },
  {
    id: "ug_smg",
    file: "submachine-gun.glb",
    modelFile: `${ROOT}/submachine-gun.glb`,
    family: "rifle",
    weaponId: "rifle",
    label: "SMG",
    ammo: "light",
    dropWeight: 1.1,
    reserveDefault: 90,
    adsFovMul: 0.94,
    hipSpread: 0.055,
    adsSpread: 0.022,
    loadoutOverride: { clip: 30, burst: 1, fireLock: 0.09, damage: 8 },
  },
  {
    id: "ug_assault",
    file: "assault-rifle.glb",
    modelFile: `${ROOT}/assault-rifle.glb`,
    family: "rifle",
    weaponId: "rifle",
    label: "Assault Rifle",
    ammo: "medium",
    dropWeight: 1.0,
    reserveDefault: 72,
    adsFovMul: 0.88,
    hipSpread: 0.035,
    adsSpread: 0.01,
  },
  {
    id: "ug_bullpup",
    file: "bullpup.glb",
    modelFile: `${ROOT}/bullpup.glb`,
    family: "rifle",
    weaponId: "rifle",
    label: "Bullpup",
    ammo: "medium",
    dropWeight: 0.85,
    reserveDefault: 72,
    adsFovMul: 0.87,
    hipSpread: 0.032,
    adsSpread: 0.009,
  },
  {
    id: "ug_sniper",
    file: "sniper-rifle.glb",
    modelFile: `${ROOT}/sniper-rifle.glb`,
    family: "sniper",
    weaponId: "hunter-rifle",
    label: "Sniper Rifle",
    ammo: "heavy",
    dropWeight: 0.55,
    reserveDefault: 24,
    adsFovMul: 0.62,
    hipSpread: 0.08,
    adsSpread: 0.004,
  },
  {
    id: "ug_shotgun",
    file: "shotgun.glb",
    modelFile: `${ROOT}/shotgun.glb`,
    family: "shotgun",
    weaponId: "shotgun",
    label: "Shotgun",
    ammo: "shell",
    dropWeight: 0.9,
    reserveDefault: 24,
    adsFovMul: 0.9,
    hipSpread: 0.12,
    adsSpread: 0.06,
  },
  {
    id: "ug_shotgun_sawed",
    file: "shotgun-sawed-off.glb",
    modelFile: `${ROOT}/shotgun-sawed-off.glb`,
    family: "shotgun",
    weaponId: "shotgun",
    label: "Sawed-Off",
    ammo: "shell",
    dropWeight: 0.7,
    reserveDefault: 18,
    adsFovMul: 0.95,
    hipSpread: 0.18,
    adsSpread: 0.1,
    loadoutOverride: { clip: 2, fireLock: 0.7, damage: 9 },
  },
  {
    id: "ug_shotgun_short",
    file: "shotgun-short-stock.glb",
    modelFile: `${ROOT}/shotgun-short-stock.glb`,
    family: "shotgun",
    weaponId: "shotgun",
    label: "Short Stock Shotgun",
    ammo: "shell",
    dropWeight: 0.75,
    reserveDefault: 20,
    adsFovMul: 0.92,
    hipSpread: 0.14,
    adsSpread: 0.07,
  },
];

/** Family → default pack mesh (replaces old single rifle.glb stand-ins). */
export const ULTIMATE_GUN_CANONICAL_MODEL: Record<GunFamilyId, string> = {
  pistol: `${ROOT}/revolver.glb`,
  rifle: `${ROOT}/assault-rifle.glb`,
  sniper: `${ROOT}/sniper-rifle.glb`,
  shotgun: `${ROOT}/shotgun.glb`,
};

export const AMMO_STACK_MAX: Record<AmmoTypeId, number> = {
  light: 120,
  medium: 90,
  heavy: 40,
  shell: 36,
};

export const AMMO_LABEL: Record<AmmoTypeId, string> = {
  light: "Light Rounds",
  medium: "Medium Rounds",
  heavy: "Heavy Rounds",
  shell: "Shells",
};

/** Arc Raiders-like TPS camera / fire feel (Studio focus + gun combat). */
export const TPS_ARC_RAIDERS = {
  hipFov: 68,
  adsFov: 52,
  adsBlendSec: 0.18,
  softLockInFocus: true,
  crosshairWhileFocused: true,
  sprintHipFirePenalty: 1.6,
  moveAdsSpreadMul: 1.35,
  /** Secondary aim: RMB hold while gun equipped */
  adsHold: "RMB" as const,
  primaryFire: "LMB" as const,
  reloadTap: "F" as const,
} as const;

export function ultimateGunById(id: string): UltimateGunDef | undefined {
  return ULTIMATE_GUNS.find((g) => g.id === id);
}

export function ultimateGunsForFamily(family: GunFamilyId): UltimateGunDef[] {
  return ULTIMATE_GUNS.filter((g) => g.family === family);
}

export function ultimateGunsForWeaponId(weaponId: WeaponId | string): UltimateGunDef[] {
  return ULTIMATE_GUNS.filter((g) => g.weaponId === weaponId);
}

/** Merge family loadout with pack weapon overrides. */
export function loadoutForUltimateGun(def: UltimateGunDef): GunLoadout {
  const base = { ...GUN_FAMILIES[def.family].loadout };
  return { ...base, ...def.loadoutOverride };
}

export function ammoTypeForWeaponId(weaponId: WeaponId | string): AmmoTypeId {
  if (weaponId === "pistol") return "light";
  if (weaponId === "shotgun") return "shell";
  if (weaponId === "hunter-rifle") return "heavy";
  return "medium";
}

/** Default reserve ammo when picking a family weapon. */
export function defaultReserveForWeapon(weaponId: WeaponId | string): number {
  const list = ultimateGunsForWeaponId(weaponId as WeaponId);
  if (list[0]) return list[0].reserveDefault;
  return ammoTypeForWeaponId(weaponId) === "heavy" ? 24 : 60;
}

/**
 * Resolve model path for a gun weapon — prefers Ultimate Guns pack.
 * Optional `skinId` = ug_* catalog id.
 */
export function resolveGunModelFile(
  weaponId: WeaponId | string,
  skinId?: string | null,
): string {
  if (skinId) {
    const skin = ultimateGunById(skinId);
    if (skin) return skin.modelFile;
  }
  const fam =
    weaponId === "pistol"
      ? "pistol"
      : weaponId === "shotgun"
        ? "shotgun"
        : weaponId === "hunter-rifle"
          ? "sniper"
          : weaponId === "rifle"
            ? "rifle"
            : null;
  if (fam) return ULTIMATE_GUN_CANONICAL_MODEL[fam];
  return GUN_FAMILIES.rifle.modelFile;
}
