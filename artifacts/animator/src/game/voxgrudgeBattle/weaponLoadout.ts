/**
 * Pre-battle weapon + sidearm catalog for VoxGrudge Battle.
 * Skills resolve via existing T0 / master-weaponSkills pipeline at equip time.
 */

import type { WeaponId } from "../../three/types";
import type { BattleLoadout } from "./types";

export interface BattleWeaponOption {
  id: WeaponId;
  label: string;
  role: "melee" | "ranged" | "magic" | "heavy";
  /** Can be equipped as primary */
  primary: boolean;
  /** Can be equipped as sidearm */
  sidearm: boolean;
  blurb: string;
}

export const BATTLE_WEAPONS: readonly BattleWeaponOption[] = [
  { id: "sword", label: "Sword", role: "melee", primary: true, sidearm: true, blurb: "Balanced combo kit · Danger Room T0." },
  { id: "greatsword", label: "Greatsword", role: "heavy", primary: true, sidearm: false, blurb: "Heavy swings · high poise break." },
  { id: "axe", label: "Axe", role: "melee", primary: true, sidearm: true, blurb: "Cleaving specials." },
  { id: "dagger", label: "Daggers", role: "melee", primary: true, sidearm: true, blurb: "Fast flanks · gap-close." },
  { id: "spear", label: "Spear", role: "melee", primary: true, sidearm: false, blurb: "Reach poke + thrust skills." },
  { id: "hammer", label: "Hammer", role: "heavy", primary: true, sidearm: false, blurb: "Stun power moves." },
  { id: "mace", label: "Mace", role: "melee", primary: true, sidearm: true, blurb: "Throw + bash kit." },
  { id: "bow", label: "Bow", role: "ranged", primary: true, sidearm: false, blurb: "Skirmish kiting." },
  { id: "crossbow", label: "Crossbow", role: "ranged", primary: true, sidearm: false, blurb: "Burst bolts." },
  { id: "pistol", label: "Pistol", role: "ranged", primary: false, sidearm: true, blurb: "Sidearm finisher." },
  { id: "rifle", label: "Rifle", role: "ranged", primary: true, sidearm: false, blurb: "Mid-range pressure." },
  { id: "shotgun", label: "Shotgun", role: "ranged", primary: true, sidearm: false, blurb: "Close burst." },
  { id: "staff", label: "Staff", role: "magic", primary: true, sidearm: false, blurb: "Bolt / nova school." },
  { id: "staffFire", label: "Fire Staff", role: "magic", primary: true, sidearm: false, blurb: "Burn DoT projectiles." },
  { id: "wand", label: "Wand", role: "magic", primary: true, sidearm: true, blurb: "Quick cast side option." },
  { id: "shield", label: "Shield", role: "melee", primary: false, sidearm: true, blurb: "Block / bash off-hand." },
] as const;

export const DEFAULT_BATTLE_LOADOUT: BattleLoadout = {
  primary: "sword",
  sidearm: "pistol",
  skillLabels: ["Combo", "Special", "Ranged", "Power"],
};

export function primaries(): BattleWeaponOption[] {
  return BATTLE_WEAPONS.filter((w) => w.primary);
}

export function sidearms(): BattleWeaponOption[] {
  return BATTLE_WEAPONS.filter((w) => w.sidearm);
}

export function isValidLoadout(l: BattleLoadout): boolean {
  const p = BATTLE_WEAPONS.find((w) => w.id === l.primary);
  const s = BATTLE_WEAPONS.find((w) => w.id === l.sidearm);
  return !!(p?.primary && s?.sidearm && l.primary !== l.sidearm);
}

export function normalizeLoadout(partial: Partial<BattleLoadout>): BattleLoadout {
  const next: BattleLoadout = {
    primary: partial.primary ?? DEFAULT_BATTLE_LOADOUT.primary,
    sidearm: partial.sidearm ?? DEFAULT_BATTLE_LOADOUT.sidearm,
    skillLabels: partial.skillLabels ?? DEFAULT_BATTLE_LOADOUT.skillLabels,
  };
  if (!isValidLoadout(next)) {
    if (next.primary === next.sidearm) next.sidearm = next.primary === "pistol" ? "dagger" : "pistol";
    if (!BATTLE_WEAPONS.find((w) => w.id === next.primary)?.primary) next.primary = "sword";
    if (!BATTLE_WEAPONS.find((w) => w.id === next.sidearm)?.sidearm) next.sidearm = "pistol";
  }
  return next;
}

const STORAGE_KEY = "grudge.voxbattle.loadout";

export function loadSavedLoadout(): BattleLoadout {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BATTLE_LOADOUT };
    return normalizeLoadout(JSON.parse(raw) as Partial<BattleLoadout>);
  } catch {
    return { ...DEFAULT_BATTLE_LOADOUT };
  }
}

export function saveLoadout(l: BattleLoadout): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeLoadout(l)));
  } catch {
    /* private mode */
  }
}
