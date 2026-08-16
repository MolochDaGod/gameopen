/**
 * Relic + Back paperdoll slots → effects / passives / procs.
 *
 * Does not invent a second combat engine. Maps equipped Relic/Back ids onto:
 *   · existing StatusFx ids (Studio.applyStatus / applyStatusScoped)
 *   · SkillEffects-shaped bonuses (characterSkillProgress)
 *   · class-relic-skillTrees.json ids (Battle Forms, Ranger's Log, Wand, Grimoire)
 *
 * Unity Relic Mount orbs = elemental proc relics.
 * Class relics = identity systems (one per class catalog).
 * Back Toon extras (quiver / bag / wood) = always-on passives + light procs.
 */
import type { StatusId } from "../types";

export type SlotEffectKind = "passive" | "proc";

export interface SlotEffectSpec {
  id: string;
  slot: "relic" | "back" | "classItem";
  label: string;
  kinds: SlotEffectKind[];
  summary: string;
  /** Self aura while equipped (StatusFx catalog). */
  aura?: StatusId;
  /** Weapon-hit proc against hostiles. */
  onHit?: { status: StatusId; chance: number; aoe?: boolean };
  bonuses: Record<string, number>;
  /** Canonical class-relic-skillTrees.json relic id. */
  classRelicId?: string;
}

/** Unity Equipment Relics (Nature / Frost / Fury / Void) + class relics. */
export const RELIC_SLOT_EFFECTS: Record<string, SlotEffectSpec> = {
  "equip:relic:nature": {
    id: "equip:relic:nature",
    slot: "relic",
    label: "Relic of Nature",
    kinds: ["passive", "proc"],
    summary: "Passive regen aura. Hits can proc Poison.",
    aura: "regen",
    onHit: { status: "poisoned", chance: 0.22, aoe: true },
    bonuses: { resistance: 10, manaRegen: 1 },
  },
  "equip:relic:frost": {
    id: "equip:relic:frost",
    slot: "relic",
    label: "Relic of Frost",
    kinds: ["passive", "proc"],
    summary: "Passive ice ward. Hits can proc Frozen.",
    aura: "shielded",
    onHit: { status: "frozen", chance: 0.16, aoe: true },
    bonuses: { resistance: 10, defense: 4 },
  },
  "equip:relic:fury": {
    id: "equip:relic:fury",
    slot: "relic",
    label: "Relic of Fury",
    kinds: ["passive", "proc"],
    summary: "Passive rage. Hits can proc Burning.",
    aura: "rage",
    onHit: { status: "burning", chance: 0.2, aoe: true },
    bonuses: { damage: 8, attackSpeed: 4 },
  },
  "equip:relic:void": {
    id: "equip:relic:void",
    slot: "relic",
    label: "Relic of the Void",
    kinds: ["passive", "proc"],
    summary: "Passive absorb. Hits can proc Cursed.",
    aura: "absorb",
    onHit: { status: "cursed", chance: 0.16, aoe: true },
    bonuses: { absorb: 8, resistance: 6 },
  },
};

/** Class item slot — class-relic-skillTrees.json (not the Relic orb slot). */
export const CLASS_ITEM_EFFECTS: Record<string, SlotEffectSpec> = {
  "equip:class:warrior": {
    id: "equip:class:warrior",
    slot: "classItem",
    label: "Battle Forms",
    kinds: ["passive"],
    summary: "Class item — Warbound Battle Forms (parry / block / stance pools).",
    aura: "empowered",
    bonuses: { defense: 8, blockChance: 5, maxStamina: 15 },
    classRelicId: "WARRIOR_BATTLE_FORMS",
  },
  "equip:class:ranger": {
    id: "equip:class:ranger",
    slot: "classItem",
    label: "Ranger's Log",
    kinds: ["passive", "proc"],
    summary: "Class item — Log poison auto-apply + quick-swap tempo.",
    aura: "haste",
    onHit: { status: "poisoned", chance: 0.18 },
    bonuses: { attackSpeed: 6 },
    classRelicId: "RANGER_LOG",
  },
  "equip:class:mage": {
    id: "equip:class:mage",
    slot: "classItem",
    label: "Wand Spellbook",
    kinds: ["passive"],
    summary: "Class item — spell book schools (portal / fire / water / heal).",
    aura: "blessed",
    bonuses: { manaRegen: 2, craftSpeed: 6 },
    classRelicId: "MAGE_WAND",
  },
  "equip:class:worge": {
    id: "equip:class:worge",
    slot: "classItem",
    label: "Nature Grimoire",
    kinds: ["passive"],
    summary: "Class item — form shifting (Bear start) + grove husbandry.",
    aura: "regen",
    bonuses: { maxHp: 12, harvest: 6 },
    classRelicId: "WORGE_NATURE_GRIMOIRE",
  },
};

/** Back Toon extras — always-on passives; quiver also procs. */
export const BACK_SLOT_EFFECTS: Record<string, SlotEffectSpec> = {
  "equip:back:wind_surf": {
    id: "equip:back:wind_surf",
    slot: "back",
    label: "Wind Surf",
    kinds: ["passive"],
    summary: "Water-only mobility vehicle. Stow pack on spine; deploy on ocean.",
    aura: "haste",
    bonuses: { swimSpeed: 20 },
  },
  "equip:back:holy_wings": {
    id: "equip:back:holy_wings",
    slot: "back",
    label: "Holy Wings",
    kinds: ["passive"],
    summary: "Jump → glide (wing type 1).",
    aura: "blessed",
    bonuses: { moveSpeed: 4 },
  },
  "equip:back:traveler_wings": {
    id: "equip:back:traveler_wings",
    slot: "back",
    label: "Traveler's Wings",
    kinds: ["passive", "proc"],
    summary: "Double-jump + two flaps, then glide (wing type 2).",
    aura: "haste",
    bonuses: { moveSpeed: 8 },
  },
  "equip:back:cape": {
    id: "equip:back:cape",
    slot: "back",
    label: "Cape",
    kinds: ["passive"],
    summary: "Land cloth back (Unity default cape).",
    bonuses: { defense: 2 },
  },
  "equip:back:cape_long": {
    id: "equip:back:cape_long",
    slot: "back",
    label: "Long Cape",
    kinds: ["passive"],
    summary: "Unity Long Cape 1.",
    bonuses: { defense: 3 },
  },
  "equip:back:cape_wide": {
    id: "equip:back:cape_wide",
    slot: "back",
    label: "Wide Cape",
    kinds: ["passive"],
    summary: "Unity Wide Cape 1.",
    bonuses: { defense: 3 },
  },
  "back:quiver": {
    id: "back:quiver",
    slot: "back",
    label: "Quiver",
    kinds: ["passive", "proc"],
    summary: "Ranged tempo passive. Hits can proc Haste.",
    aura: "haste",
    onHit: { status: "haste", chance: 0.12 },
    bonuses: { attackSpeed: 8, crit: 3 },
  },
  "back:bag": {
    id: "back:bag",
    slot: "back",
    label: "Traveler's Bag",
    kinds: ["passive"],
    summary: "Carry passive — absorb ward while the bag is shown.",
    aura: "absorb",
    bonuses: { extraInventory: 1, defense: 3 },
  },
  "back:wood": {
    id: "back:wood",
    slot: "back",
    label: "Carry Wood",
    kinds: ["passive"],
    summary: "Gather passive — harvest yield while carrying wood.",
    bonuses: { harvest: 10, craftSpeed: 4 },
  },
  "equip:back:shark_fin": {
    id: "equip:back:shark_fin",
    slot: "back",
    label: "Shark Fin",
    kinds: ["passive"],
    summary: "Passive water buff — 2× swim, shark aggro immune, breathe underwater.",
    aura: "absorb",
    bonuses: { swimSpeed: 100 },
  },
};

export const SLOT_EFFECTS: Record<string, SlotEffectSpec> = {
  ...RELIC_SLOT_EFFECTS,
  ...CLASS_ITEM_EFFECTS,
  ...BACK_SLOT_EFFECTS,
};

const LEGACY_CLASS_RELIC: Record<string, string> = {
  "equip:relic:warrior": "equip:class:warrior",
  "equip:relic:ranger": "equip:class:ranger",
  "equip:relic:mage": "equip:class:mage",
  "equip:relic:worge": "equip:class:worge",
};

export function effectForEquipId(id: string): SlotEffectSpec | null {
  const mapped = LEGACY_CLASS_RELIC[id] ?? id;
  if (SLOT_EFFECTS[mapped]) return SLOT_EFFECTS[mapped];
  const k = id.toLowerCase();
  if (/equip:back:wind/.test(k) || /back_wind/.test(k)) {
    return BACK_SLOT_EFFECTS["equip:back:wind_surf"] ?? null;
  }
  if (/holy.?wing/.test(k)) return BACK_SLOT_EFFECTS["equip:back:holy_wings"] ?? null;
  if (/traveler.?wing/.test(k)) return BACK_SLOT_EFFECTS["equip:back:traveler_wings"] ?? null;
  if (/cape_long|long.?cape/.test(k)) return BACK_SLOT_EFFECTS["equip:back:cape_long"] ?? null;
  if (/cape_wide|wide.?cape/.test(k)) return BACK_SLOT_EFFECTS["equip:back:cape_wide"] ?? null;
  if (/equip:back:cape$|back_cape$/.test(k)) return BACK_SLOT_EFFECTS["equip:back:cape"] ?? null;
  if (/shark.?fin/.test(k)) return BACK_SLOT_EFFECTS["equip:back:shark_fin"] ?? null;
  if (/quiver/.test(k)) return BACK_SLOT_EFFECTS["back:quiver"] ?? null;
  if (/wood/.test(k)) return BACK_SLOT_EFFECTS["back:wood"] ?? null;
  if (/bag/.test(k)) return BACK_SLOT_EFFECTS["back:bag"] ?? null;
  return null;
}

/** Class id for Shift+1–5 / class tree — from equipped class item (not Relic). */
export function classIdFromMeshIds(meshIds: string[] | null | undefined): string | null {
  for (const spec of resolveSlotEffects(meshIds)) {
    if (spec.slot === "classItem" && spec.classRelicId) {
      if (spec.id.endsWith(":warrior")) return "warrior";
      if (spec.id.endsWith(":ranger")) return "ranger";
      if (spec.id.endsWith(":mage")) return "mage";
      if (spec.id.endsWith(":worge")) return "worge";
    }
  }
  return null;
}

export function classTreeIdFromMeshIds(meshIds: string[] | null | undefined): string | null {
  const id = classIdFromMeshIds(meshIds);
  return id ? `class-${id}` : null;
}

export function resolveSlotEffects(meshIds: string[] | null | undefined): SlotEffectSpec[] {
  const out: SlotEffectSpec[] = [];
  const seen = new Set<string>();
  for (const id of meshIds ?? []) {
    const spec = effectForEquipId(id);
    if (!spec || seen.has(spec.id)) continue;
    seen.add(spec.id);
    out.push(spec);
  }
  return out;
}

export function slotEffectLines(spec: SlotEffectSpec): string[] {
  const kinds = spec.kinds.join(" · ");
  const lines = [`${spec.label} (${kinds})`, spec.summary];
  if (spec.aura) lines.push(`Aura: ${spec.aura}`);
  if (spec.onHit) {
    lines.push(
      `Proc: ${Math.round(spec.onHit.chance * 100)}% ${spec.onHit.status}${spec.onHit.aoe ? " (AoE)" : ""}`,
    );
  }
  const bonus = Object.entries(spec.bonuses)
    .map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`)
    .join(" · ");
  if (bonus) lines.push(bonus);
  return lines;
}
