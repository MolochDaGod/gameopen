/**
 * Unit mesh bind — factionUnits / RTS roster → grudge6 uMMORPG-style prefabs.
 *
 * Units, commanders, and travelers use Toon RTS race kits (Standard Units
 * atlases) via warlordsRoles + EntityPrefab. Converted heroes stay T0 equip.
 */

import type { RaceId } from "../grudge/raceAssets";
import type { PresetId } from "../grudge/gearPresets";
import {
  WARLORDS_ROLES,
  getWarlordsRole,
  warlordsRolesOfKind,
  type WarlordsRole,
  type WarlordsRoleKind,
} from "../grudge/warlordsRoles";
import {
  prefabFromWarlordsRole,
  prefabFromRoleId,
  type EntityPrefab,
} from "../ummorpg/prefabProfile";

/** RTS unit combat type → gear preset (mesh visibility kit). */
export function presetForUnitType(unitType: string): PresetId {
  switch ((unitType || "").toLowerCase()) {
    case "ranged":
    case "archer":
      return "ranger";
    case "magic":
    case "mage":
    case "wizard":
      return "mage";
    case "support":
    case "priest":
      return "mage";
    case "heavy":
    case "knight":
    case "cavalry":
      return "knight";
    case "melee":
    case "soldier":
    default:
      return "warrior";
  }
}

/** Faction id from factionUnits.json → grudge6 race. */
export function raceForFaction(factionId: string): RaceId {
  switch ((factionId || "").toLowerCase()) {
    case "legion":
      return "undead";
    case "fabled":
      return "high-elves";
    case "crusade":
    default:
      return "western-kingdoms";
  }
}

/**
 * Map a camp/RTS unit def id (e.g. crusade_archer) to a Warlords role id.
 * Prefers explicit catalog, then best-effort kind match.
 */
const UNIT_ROLE_MAP: Record<string, string> = {
  // Crusade (human / WK)
  crusade_archer: "hostile-wk-ranger",
  crusade_soldier: "hostile-wk-warrior",
  crusade_swordsman: "hostile-wk-warrior",
  crusade_knight: "hostile-wk-knight",
  crusade_wizard: "hostile-wk-mage",
  crusade_priest: "hostile-wk-mage",
  crusade_lancer: "hostile-wk-knight",
  // Fabled (elves-ish)
  fabled_archer: "hostile-elf-ranger",
  fabled_armored_axeman: "hostile-elf-warrior",
  fabled_knight_templar: "hostile-elf-knight",
  fabled_mage: "hostile-elf-mage",
  fabled_priest: "hostile-elf-mage",
  fabled_werebear: "hostile-brb-brawler",
  // Legion (undead / orc heavy)
  legion_skeleton: "hostile-ud-warrior",
  legion_skeleton_archer: "hostile-ud-shade",
  legion_armored_skeleton: "hostile-ud-dk",
  legion_greatsword_skeleton: "hostile-ud-warrior",
  legion_elite_orc: "hostile-orc-warchief",
  legion_orc_rider: "hostile-orc-warrior",
};

export type UnitMeshBind = {
  defId: string;
  roleId: string;
  prefab: EntityPrefab;
  raceId: RaceId;
  presetId: PresetId;
  kind: WarlordsRoleKind | "player" | "commander" | "unit";
  /** CDN / kit mesh source note */
  meshSource: string;
};

export function bindUnitMesh(
  defId: string,
  opts?: { factionId?: string; unitType?: string; name?: string },
): UnitMeshBind {
  // 1) Direct uMMORPG / warlords role id (commander-*, traveler-*, hostile-*, …)
  let role = getWarlordsRole(defId);

  // 2) RTS factionUnits id → role map
  if (!role) {
    const mapped = UNIT_ROLE_MAP[defId];
    role = mapped ? getWarlordsRole(mapped) : undefined;
  }

  // 3) Faction + type best-effort
  if (!role && opts?.factionId && opts?.unitType) {
    const race = raceForFaction(opts.factionId);
    const preset = presetForUnitType(opts.unitType);
    role = WARLORDS_ROLES.find(
      (r) => r.kind === "hostile" && r.raceId === race && r.presetId === preset,
    );
  }

  if (!role) {
    role = getWarlordsRole("hostile-wk-warrior")!;
  }

  const prefab = prefabFromWarlordsRole(role);
  const kind: UnitMeshBind["kind"] =
    role.kind === "commander"
      ? "commander"
      : role.kind === "traveler"
        ? "traveler"
        : role.kind === "player"
          ? "player"
          : "unit";

  return {
    defId,
    roleId: role.id,
    prefab,
    raceId: role.raceId,
    presetId: role.presetId,
    kind,
    meshSource: `grudge6 ${role.raceId} / ${role.presetId} (uMMORPG EntityPrefab · Toon RTS kit)`,
  };
}

export function bindRoleMesh(roleId: string): UnitMeshBind | null {
  const role = getWarlordsRole(roleId);
  if (!role) return null;
  const prefab = prefabFromWarlordsRole(role);
  return {
    defId: roleId,
    roleId,
    prefab,
    raceId: role.raceId,
    presetId: role.presetId,
    kind: role.kind as UnitMeshBind["kind"],
    meshSource: `grudge6 ${role.raceId} · role ${role.id}`,
  };
}

/** Prefab unit catalog for camp Units page (hostile + commander + traveler). */
export function listPrefabUnits(): EntityPrefab[] {
  return WARLORDS_ROLES.filter((r) =>
    r.kind === "hostile" || r.kind === "commander" || r.kind === "guard",
  ).map(prefabFromWarlordsRole);
}

export function listCommanders(): EntityPrefab[] {
  return warlordsRolesOfKind("commander").map(prefabFromWarlordsRole);
}

export function listTravelers(): EntityPrefab[] {
  return warlordsRolesOfKind("traveler").map(prefabFromWarlordsRole);
}

export function listMerchants(): EntityPrefab[] {
  return warlordsRolesOfKind("merchant").map(prefabFromWarlordsRole);
}

/** Resolve prefab for converted hero (T0 player kit from unit race/preset). */
export function heroPrefabFromUnitBind(bind: UnitMeshBind, name?: string): EntityPrefab {
  const p = prefabFromRoleId(
    `player-${bind.raceId}-${bind.presetId === "unarmed" ? "warrior" : bind.presetId}`,
  );
  // Build lightweight player-facing prefab
  return {
    ...bind.prefab,
    id: `hero-from-${bind.defId}`,
    label: name || `${bind.prefab.label} (Hero)`,
    kind: "player",
    isPlayer: true,
    aggro: 0,
    maxHp: 150,
    // T0 only — keep starter weapon from preset
  };
}

export type { WarlordsRole, EntityPrefab };
