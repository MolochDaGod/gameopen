/**
 * Prefab profiles — uMMORPG Entity / Npc / Monster spawn data for web.
 *
 * Unity: Player, Npc, Monster prefabs share Entity base (health, skills,
 * equipment, animator). Web: same fields as typed profiles driving
 * GrudgeAvatar / Targets / Brawler hostiles.
 */
import type { WeaponId } from "../types";
import type { RaceId } from "../grudge/raceAssets";
import { getPreset, type PresetId } from "../grudge/gearPresets";
import {
  WARLORDS_ROLES,
  type WarlordsRole,
  type WarlordsRoleKind,
  getWarlordsRole,
  presetForWeaponKind,
} from "../grudge/warlordsRoles";

/** Combat classification mirroring uMMORPG damage / cast style. */
export type CombatStyle = "melee" | "ranged" | "magic" | "hybrid";

export interface PrefabCombatProfile {
  /** Melee / projectile engagement range (m) — grudge6-combat-runtime tables */
  range: number;
  attackCooldown: number;
  damage: number;
  /** Hit active window as fraction of attack clip [start, end] */
  hitWindow: [number, number];
  style: CombatStyle;
  animPack: string;
  /** Master-weaponSkills type id when applicable */
  masterWeaponType?: string;
}

export interface EntityPrefab {
  id: string;
  label: string;
  kind: WarlordsRoleKind | "player";
  raceId: RaceId;
  presetId: PresetId;
  meshIds: string[];
  /** Preferred arsenal WeaponId for skills / mount */
  weaponId: WeaponId;
  offHand: WeaponId | null;
  combat: PrefabCombatProfile;
  /** AI aggressiveness 0..1 (uMMORPG Monster.followDistance / attack) */
  aggro: number;
  /** Move speed m/s */
  moveSpeed: number;
  maxHp: number;
  /** True for player-controlled prefab */
  isPlayer: boolean;
}

/** Weapon → combat numbers (shared with grudge6-combat-runtime). */
export const WEAPON_COMBAT: Record<
  string,
  { range: number; style: CombatStyle; cd: number; damage: number; pack: string; master?: string }
> = {
  sword: { range: 2.5, style: "melee", cd: 1.1, damage: 45, pack: "sword_shield", master: "SWORD" },
  axe: { range: 2.6, style: "melee", cd: 1.2, damage: 50, pack: "sword_shield", master: "AXE" },
  greataxe: { range: 3.0, style: "melee", cd: 1.4, damage: 65, pack: "polearm", master: "GREATAXE" },
  greatsword: { range: 2.9, style: "melee", cd: 1.35, damage: 60, pack: "polearm", master: "GREATSWORD" },
  hammer: { range: 2.7, style: "melee", cd: 1.25, damage: 55, pack: "sword_shield", master: "HAMMER" },
  mace: { range: 2.5, style: "melee", cd: 1.15, damage: 48, pack: "sword_shield", master: "MACE" },
  spear: { range: 4.0, style: "melee", cd: 1.0, damage: 50, pack: "polearm", master: "SPEAR" },
  javelin: { range: 4.0, style: "melee", cd: 1.1, damage: 48, pack: "polearm", master: "SPEAR" },
  dagger: { range: 1.9, style: "melee", cd: 0.85, damage: 35, pack: "sword_shield", master: "DAGGER" },
  bow: { range: 22, style: "ranged", cd: 1.3, damage: 40, pack: "longbow", master: "BOW" },
  crossbow: { range: 24, style: "ranged", cd: 1.6, damage: 48, pack: "longbow", master: "CROSSBOW" },
  pistol: { range: 16, style: "ranged", cd: 0.9, damage: 38, pack: "rifle", master: "GUN" },
  rifle: { range: 24, style: "ranged", cd: 1.1, damage: 42, pack: "rifle", master: "GUN" },
  "hunter-rifle": { range: 32, style: "ranged", cd: 1.5, damage: 55, pack: "rifle", master: "GUN" },
  shotgun: { range: 9, style: "ranged", cd: 1.2, damage: 48, pack: "rifle", master: "GUN" },
  staff: { range: 18, style: "magic", cd: 1.4, damage: 42, pack: "magic", master: "STAFF" },
  staffFire: { range: 18, style: "magic", cd: 1.4, damage: 45, pack: "magic", master: "STAFF" },
  wand: { range: 16, style: "magic", cd: 1.0, damage: 32, pack: "magic", master: "WAND" },
  tome: { range: 17, style: "magic", cd: 1.5, damage: 40, pack: "magic", master: "TOME" },
  shield: { range: 2.2, style: "melee", cd: 1.5, damage: 20, pack: "sword_shield", master: "SHIELD" },
  none: { range: 2.0, style: "melee", cd: 0.9, damage: 28, pack: "unarmed" },
  unarmed: { range: 2.0, style: "melee", cd: 0.9, damage: 28, pack: "unarmed" },
};

const PRESET_WEAPON: Record<string, { weaponId: WeaponId; offHand: WeaponId | null }> = {
  mage: { weaponId: "staffFire", offHand: null },
  knight: { weaponId: "sword", offHand: "shield" },
  ranger: { weaponId: "bow", offHand: null },
  warrior: { weaponId: "greataxe", offHand: null },
  unarmed: { weaponId: "none", offHand: null },
};

const KIND_AGGRO: Record<string, number> = {
  player: 0,
  hostile: 0.85,
  traveler: 0.1,
  merchant: 0,
  guard: 0.4,
  quest_npc: 0,
  commander: 0.55,
};

const KIND_HP: Record<string, number> = {
  player: 150,
  hostile: 80,
  traveler: 60,
  merchant: 50,
  guard: 120,
  quest_npc: 70,
  commander: 160,
};

function combatForWeapon(weaponId: WeaponId): PrefabCombatProfile {
  const w = WEAPON_COMBAT[weaponId] || WEAPON_COMBAT.sword!;
  return {
    range: w.range,
    attackCooldown: w.cd,
    damage: w.damage,
    hitWindow: [0.28, 0.55],
    style: w.style,
    animPack: w.pack,
    masterWeaponType: w.master,
  };
}

/** Build EntityPrefab from Warlords role catalog entry. */
export function prefabFromWarlordsRole(role: WarlordsRole): EntityPrefab {
  const gear = getPreset(role.raceId, role.presetId);
  const wep = PRESET_WEAPON[role.presetId] || PRESET_WEAPON.warrior!;
  return {
    id: role.id,
    label: role.label,
    kind: role.kind,
    raceId: role.raceId,
    presetId: role.presetId,
    meshIds: gear.visibleMeshes.slice(),
    weaponId: wep.weaponId,
    offHand: wep.offHand,
    combat: combatForWeapon(wep.weaponId),
    aggro: KIND_AGGRO[role.kind] ?? 0.5,
    moveSpeed:
      role.kind === "hostile" ? 2.6 : role.kind === "commander" ? 2.8 : 2.2,
    maxHp: KIND_HP[role.kind] ?? 80,
    isPlayer: role.kind === "player",
  };
}

/** Prefab units for camp training (hostile RTS kits). */
export function listUnitPrefabs(): EntityPrefab[] {
  return WARLORDS_ROLES.filter((r) => r.kind === "hostile").map(prefabFromWarlordsRole);
}

/** Commanders — elite camp leaders (uMMORPG-style). */
export function listCommanderPrefabs(): EntityPrefab[] {
  return WARLORDS_ROLES.filter((r) => r.kind === "commander").map(prefabFromWarlordsRole);
}

/** Travelers — road NPCs. */
export function listTravelerPrefabs(): EntityPrefab[] {
  return WARLORDS_ROLES.filter((r) => r.kind === "traveler").map(prefabFromWarlordsRole);
}

export function prefabFromRoleId(id: string): EntityPrefab | null {
  const role = getWarlordsRole(id);
  return role ? prefabFromWarlordsRole(role) : null;
}

/** Player prefab from race + class + optional mesh_ids / weapon. */
export function playerPrefab(opts: {
  raceId: RaceId;
  presetId: PresetId;
  meshIds?: string[];
  weaponId?: WeaponId;
  offHand?: WeaponId | null;
  maxHp?: number;
  name?: string;
}): EntityPrefab {
  const gear = getPreset(opts.raceId, opts.presetId);
  const def = PRESET_WEAPON[opts.presetId] || PRESET_WEAPON.warrior!;
  const weaponId = opts.weaponId || def.weaponId;
  return {
    id: `player-${opts.raceId}-${opts.presetId}`,
    label: opts.name || `${opts.raceId} ${opts.presetId}`,
    kind: "player",
    raceId: opts.raceId,
    presetId: opts.presetId,
    meshIds: opts.meshIds?.length ? opts.meshIds : gear.visibleMeshes.slice(),
    weaponId,
    offHand: opts.offHand !== undefined ? opts.offHand : def.offHand,
    combat: combatForWeapon(weaponId),
    aggro: 0,
    moveSpeed: 4.5,
    maxHp: opts.maxHp ?? 150,
    isPlayer: true,
  };
}

/** All hostile prefabs for wave / Danger Room spawns. */
export function listHostilePrefabs(): EntityPrefab[] {
  return WARLORDS_ROLES.filter((r) => r.kind === "hostile").map(prefabFromWarlordsRole);
}

/** Map arsenal kind string → gear preset (picker / AI). */
export { presetForWeaponKind };
