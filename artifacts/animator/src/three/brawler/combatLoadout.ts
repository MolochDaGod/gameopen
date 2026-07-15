/**
 * Brawler / Agama Survival combat loadout — same sources as Danger Room.
 *
 * Order of truth:
 *  1. Fleet character (Railway) + saveData.open loadout
 *  2. Fleet equipment bag / class defaults (fleetCharacter)
 *  3. Grudge6 race avatar (`grudge:race:preset`) + arsenal WEAPONS
 *  4. T0 weapon skill kits (Danger Room combat sheet)
 *  5. Soft overlays from content API + ObjectStore master-weaponSkills
 */
import type { WeaponId } from "../types";
import { WEAPONS, getT0Kit, t0SignatureSkills, mmToMeters } from "../arsenal";
import { getWeapon } from "../assets";
import { resolveSlotIconUrl } from "../skillIcons";
import { contentUrl } from "../../lib/fleet";
import { loadoutFromCharacter } from "../../lib/characterLoadout";
import { resolveRaceModel } from "../../lib/raceModel";
import {
  fleetCharacterToLoadout,
  guestLoadout,
  type FleetCharacter,
  type FleetPlayerLoadout,
} from "../../auth/fleetCharacter";
import type { GrudgeCharacter } from "../../lib/grudgeAuth";
import { gameSession } from "../../game/GameSession";

/** Main-hand weapons the brawler strip can equip (Danger Room arsenal). */
export function mainWeaponCycle(): WeaponId[] {
  return WEAPONS.filter((w) => {
    if (w.id === "none") return true;
    const g = w.group ?? "unarmed";
    if (g === "off-hand") return false;
    return (
      g === "melee-1h" ||
      g === "melee-2h" ||
      g === "ranged" ||
      g === "magic" ||
      g === "unarmed"
    );
  }).map((w) => w.id);
}

export interface ResolvedBrawlerLoadout {
  /** Studio-style avatar id: `grudge:race:preset` preferred. */
  avatarId: string;
  /** Catalog fallback `grudge-{race}-{class}` if GLB pack is preferred later. */
  catalogCharacterId: string;
  weaponId: WeaponId;
  offHand: WeaponId | null;
  displayName: string;
  characterClass: string;
  raceId: string;
  maxHp: number;
  atk: number;
  /** True when a signed-in fleet row drove this kit. */
  authenticated: boolean;
  fleetId: string;
}

/**
 * Resolve the active Open player into a full combat kit for BrawlerScene.
 */
export function resolveBrawlerLoadout(
  fleetChar?: GrudgeCharacter | null,
): ResolvedBrawlerLoadout {
  const ch =
    fleetChar ??
    (gameSession.selectedCharacter() as GrudgeCharacter | null | undefined) ??
    null;

  const race = resolveRaceModel(ch);
  const open = loadoutFromCharacter(ch);

  // Map GrudgeCharacter → FleetCharacter shape for class/weapon defaults
  const asFleet: FleetCharacter = ch
    ? {
        id: String(ch.id || ""),
        name: ch.name,
        raceId: ch.raceId,
        race: ch.raceId,
        classId: ch.classId,
        class: ch.classId,
        equipment: (ch as { equipment?: Record<string, unknown> }).equipment,
        stats: (ch as { stats?: Record<string, unknown> }).stats,
        maxHp: (ch as { maxHp?: number }).maxHp,
        hp: (ch as { hp?: number }).hp,
      }
    : { id: "guest", name: "Guest Adventurer", race: "western-kingdoms", class: "warrior" };

  const fleet: FleetPlayerLoadout = ch
    ? fleetCharacterToLoadout(asFleet, true)
    : guestLoadout();

  // Prefer open save loadout weapon, then equipment bag, then class default
  const weaponId = (open.weaponId || fleet.weaponId || "sword") as WeaponId;
  const offHand =
    open.offHand !== undefined ? open.offHand : fleet.offHand;

  // Prefer grudge: avatar (GrudgeAvatar combat rig) over static catalog GLB
  const avatarId = open.avatarId || race.avatarId;

  return {
    avatarId,
    catalogCharacterId: fleet.characterId,
    weaponId,
    offHand,
    displayName: fleet.displayName || ch?.name || "Open Player",
    characterClass: fleet.classSlug || ch?.classId || race.presetId || "warrior",
    raceId: race.raceId,
    maxHp: fleet.maxHp,
    atk: fleet.atk,
    authenticated: fleet.authenticated,
    fleetId: fleet.fleetId,
  };
}

export interface BrawlerSkillHud {
  slot: 1 | 2 | 3 | 4;
  label: string;
  key: string;
  clip: string;
  reach: number;
  damage: number;
  cdMax: number;
  lunge: number;
  iconUrl: string;
  kind: string;
}

/** Build 4 skill slots from T0 kit + arsenal combat (Danger Room parity). */
export function buildT0SkillHud(
  weaponId: WeaponId,
  atk = 16,
): BrawlerSkillHud[] {
  const keys = ["1", "2", "3", "4"] as const;
  const sigs = t0SignatureSkills(weaponId);
  const kit = getT0Kit(weaponId);
  const wdef = getWeapon(weaponId);
  const baseIntensity = wdef.combat?.intensity ?? 22;

  return [0, 1, 2, 3].map((i) => {
    const sig = sigs[i]!;
    const t0 = kit.skills[i]!;
    const roles = ["sig1", "sig2", "sig3", "sig4"] as const;
    const mm = sig.mm ?? t0.mm;
    const reach = Math.max(1.6, 1.9 + Math.max(0, mm) * 0.012);
    const lunge =
      sig.mode === "dash" || t0.mode === "dash"
        ? Math.max(4.5, Math.abs(mm) * 0.055)
        : Math.max(1.2, Math.max(0, mm) * 0.028);
    const damage = Math.round(
      baseIntensity * 0.85 + atk * 0.9 + Math.abs(mm) * 0.22 + i * 4,
    );
    return {
      slot: (i + 1) as 1 | 2 | 3 | 4,
      label: sig.label || t0.label,
      key: keys[i]!,
      clip: sig.clip || "attack",
      reach,
      damage,
      cdMax: sig.cooldown ?? t0.cooldown ?? 1.6 + i * 0.6,
      lunge,
      iconUrl: resolveSlotIconUrl(roles[i]!, weaponId),
      kind: sig.kind || t0.kind,
    };
  });
}

export interface ContentCatalogOverlay {
  weapons: Array<{ id: string; family?: string; skills?: string[]; icon?: { cdnUrl?: string } }>;
  skills: Array<{ id: string; label?: string; name?: string; icon?: { cdnUrl?: string } }>;
  items: Array<{ id: string; name?: string; type?: string }>;
  masterSkills: unknown | null;
  loadedAt: number;
}

let _catalog: ContentCatalogOverlay | null = null;
let _catalogPromise: Promise<ContentCatalogOverlay> | null = null;

/**
 * Soft-load gameopen content API + ObjectStore master-weaponSkills.
 * Never throws — empty arrays on failure so offline play still works.
 */
export async function softLoadContentCatalog(): Promise<ContentCatalogOverlay> {
  if (_catalog) return _catalog;
  if (_catalogPromise) return _catalogPromise;

  _catalogPromise = (async () => {
    const empty: ContentCatalogOverlay = {
      weapons: [],
      skills: [],
      items: [],
      masterSkills: null,
      loadedAt: Date.now(),
    };

    const tryJson = async (url: string): Promise<unknown | null> => {
      try {
        const r = await fetch(url, { credentials: "include" });
        if (!r.ok) return null;
        return await r.json();
      } catch {
        return null;
      }
    };

    const [weaponsBody, skillsBody, itemsBody, master] = await Promise.all([
      tryJson("/api/content/weapons"),
      tryJson("/api/content/skills"),
      tryJson("/api/content/items"),
      tryJson(contentUrl("master-weaponSkills.json")),
    ]);

    const weapons =
      weaponsBody &&
      typeof weaponsBody === "object" &&
      Array.isArray((weaponsBody as { weapons?: unknown }).weapons)
        ? ((weaponsBody as { weapons: ContentCatalogOverlay["weapons"] }).weapons)
        : [];
    const skills =
      skillsBody &&
      typeof skillsBody === "object" &&
      Array.isArray((skillsBody as { skills?: unknown }).skills)
        ? ((skillsBody as { skills: ContentCatalogOverlay["skills"] }).skills)
        : [];
    const items =
      itemsBody &&
      typeof itemsBody === "object" &&
      Array.isArray((itemsBody as { items?: unknown }).items)
        ? ((itemsBody as { items: ContentCatalogOverlay["items"] }).items)
        : [];

    _catalog = {
      weapons,
      skills,
      items,
      masterSkills: master,
      loadedAt: Date.now(),
    };
    console.info(
      "[combatLoadout] content catalog",
      `weapons=${weapons.length}`,
      `skills=${skills.length}`,
      `items=${items.length}`,
      `master=${master ? "ok" : "miss"}`,
    );
    return _catalog;
  })();

  return _catalogPromise;
}

/**
 * Overlay content-API skill labels onto T0 slots when family matches weapon.
 */
export function applyContentSkillLabels(
  hud: BrawlerSkillHud[],
  weaponId: WeaponId,
  catalog: ContentCatalogOverlay | null,
): BrawlerSkillHud[] {
  if (!catalog?.weapons?.length) return hud;
  const family = String(weaponId).replace(/2h|Fire|Ice|Storm|Nature|Holy/g, "").toLowerCase();
  const match = catalog.weapons.find((w) => {
    const f = String(w.family || w.id || "").toLowerCase();
    return f.includes(family) || family.includes(f.replace(/wpn_|itm_/g, ""));
  });
  if (!match?.skills?.length) return hud;
  return hud.map((slot, i) => {
    const skillId = match.skills![i];
    if (!skillId) return slot;
    const def = catalog.skills.find((s) => s.id === skillId);
    if (!def) return slot;
    const label = def.label || def.name || slot.label;
    const iconUrl =
      def.icon?.cdnUrl ||
      match.icon?.cdnUrl ||
      slot.iconUrl;
    return { ...slot, label, iconUrl };
  });
}

export function weaponStripEntries(cycle: WeaponId[] = mainWeaponCycle()) {
  return cycle.map((id) => {
    const def = getWeapon(id);
    return {
      id,
      label: def.label,
      iconUrl: resolveSlotIconUrl("primary", id),
      group: def.group ?? "unarmed",
    };
  });
}

/** Debug / HUD helper — MM as meters for VFX distance. */
export function skillMmMeters(weaponId: WeaponId, slotIndex: number): number {
  const s = t0SignatureSkills(weaponId)[slotIndex];
  return mmToMeters(s?.mm ?? 70);
}
