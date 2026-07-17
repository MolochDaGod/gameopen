/**
 * Classes, skill trees, professions, weapon types, mastery.
 *
 * Class combat trees for production UI come from fleet SSOT:
 *   info/master-skillTrees.json → loadClassSkillTreesFromFleet / ClassSkillTreePanel
 *   classes.json (abilities) on character.grudge-studio.com/skills
 *
 * Static CLASSES/CLASS_SKILLS below are the existing Creator GameData mirror
 * (grudge-character-creator) for offline labels only — not a redesign.
 */

import creatorClassData from "./_creatorClassData.json";

export type SkillNode = {
  id: string;
  name: string;
  level: number;
  desc: string;
  cost?: number;
  bonus?: string;
  model?: string;
  /** Original pack / catalog icon path */
  icon?: string;
  /** Absolute CDN URL for UI */
  iconUrl?: string;
  slot?: string;
};

export type SkillTree = {
  name: string;
  icon: string;
  desc: string;
  skills: SkillNode[];
};

export type ClassDef = {
  name: string;
  icon: string;
  color: string;
  desc: string;
  primaryAttr: string;
  secondaryAttr: string;
  weaponTypes: string[];
  passive: string;
  abilities: string[];
};

/** Existing Creator class cards (not rewritten). */
export const CLASSES = creatorClassData.CLASSES as Record<string, ClassDef>;

/** Existing Creator nested class trees (fallback labels). Prefer fleet master-skillTrees in UI. */
export const CLASS_SKILLS = creatorClassData.CLASS_SKILLS as Record<
  string,
  { trees: Record<string, SkillTree> }
>;

export type ProfessionDef = {
  name: string;
  icon: string;
  color: string;
  desc: string;
  attr: string;
  tiers: Array<{ level: number; name: string; resources: string[] }>;
};

export const PROFESSIONS: Record<string, ProfessionDef> = {
  mining: {
    name: "Mining",
    icon: "⛏️",
    color: "#a8a8a8",
    desc: "Extract ores, gems, and rare minerals from rock formations.",
    attr: "STR",
    tiers: [
      { level: 1, name: "Apprentice Miner", resources: ["Copper Ore", "Tin Ore", "Stone"] },
      { level: 10, name: "Journeyman Miner", resources: ["Iron Ore", "Coal", "Silver Ore"] },
      { level: 25, name: "Expert Miner", resources: ["Gold Ore", "Mithril Ore", "Gems"] },
      { level: 40, name: "Artisan Miner", resources: ["Adamantite", "Starstone", "Rare Gems"] },
      { level: 60, name: "Master Miner", resources: ["Void Crystal", "Dragon Ore", "Legendary Gems"] },
    ],
  },
  herbalism: {
    name: "Herbalism",
    icon: "🌿",
    color: "#22c55e",
    desc: "Gather herbs, flowers, and magical plants for alchemy.",
    attr: "WIS",
    tiers: [
      { level: 1, name: "Apprentice Herbalist", resources: ["Peacebloom", "Silverleaf", "Earthroot"] },
      { level: 10, name: "Journeyman Herbalist", resources: ["Mageroyal", "Briarthorn", "Swiftthistle"] },
      { level: 25, name: "Expert Herbalist", resources: ["Goldthorn", "Khadgar's Whisker", "Firebloom"] },
      { level: 40, name: "Artisan Herbalist", resources: ["Dreamfoil", "Mountain Silversage", "Plaguebloom"] },
      { level: 60, name: "Master Herbalist", resources: ["Black Lotus", "Fel Lotus", "Nightmare Vine"] },
    ],
  },
  woodcutting: {
    name: "Woodcutting",
    icon: "🪓",
    color: "#92400e",
    desc: "Fell trees and harvest rare woods for construction and crafting.",
    attr: "END",
    tiers: [
      { level: 1, name: "Apprentice Logger", resources: ["Oak Log", "Pine Log", "Bark"] },
      { level: 10, name: "Journeyman Logger", resources: ["Maple Log", "Birch Log", "Resin"] },
      { level: 25, name: "Expert Logger", resources: ["Ironwood", "Darkwood", "Amber Sap"] },
      { level: 40, name: "Artisan Logger", resources: ["Spiritwood", "Petrified Log", "Elder Sap"] },
      { level: 60, name: "Master Logger", resources: ["World Tree Branch", "Void Wood", "Eternal Sap"] },
    ],
  },
  skinning: {
    name: "Skinning",
    icon: "🔪",
    color: "#dc2626",
    desc: "Skin beasts and monsters for leather, scales, and bone.",
    attr: "DEX",
    tiers: [
      { level: 1, name: "Apprentice Skinner", resources: ["Light Leather", "Bone Fragment", "Sinew"] },
      { level: 10, name: "Journeyman Skinner", resources: ["Medium Leather", "Thick Hide", "Fang"] },
      { level: 25, name: "Expert Skinner", resources: ["Heavy Leather", "Dragon Scale", "Claw"] },
      { level: 40, name: "Artisan Skinner", resources: ["Runic Leather", "Ancient Scale", "Spirit Bone"] },
      { level: 60, name: "Master Skinner", resources: ["Void Leather", "Titan Scale", "Primordial Bone"] },
    ],
  },
  fishing: {
    name: "Fishing",
    icon: "🎣",
    color: "#3b82f6",
    desc: "Catch fish, treasure, and rare aquatic materials.",
    attr: "LCK",
    tiers: [
      { level: 1, name: "Apprentice Fisher", resources: ["Trout", "Bass", "Clam"] },
      { level: 10, name: "Journeyman Fisher", resources: ["Salmon", "Swordfish", "Pearl"] },
      { level: 25, name: "Expert Fisher", resources: ["Golden Fish", "Electric Eel", "Black Pearl"] },
      { level: 40, name: "Artisan Fisher", resources: ["Kraken Tentacle", "Abyssal Fish", "Sea Diamond"] },
      { level: 60, name: "Master Fisher", resources: ["Leviathan Scale", "Void Fish", "Ocean Heart"] },
    ],
  },
};

export type WeaponTypeDef = {
  name: string;
  icon: string;
  hand: "1h" | "2h" | "oh";
  classes: string[];
  /** Open arsenal / CDN icon key when available */
  openWeaponId?: string;
  cdnIcon?: string;
};

const CDN = "https://assets.grudge-studio.com";

export const WEAPON_TYPES: Record<string, WeaponTypeDef> = {
  sword: {
    name: "1H Sword",
    icon: "⚔️",
    hand: "1h",
    classes: ["warrior", "ranger"],
    openWeaponId: "sword",
    cdnIcon: `${CDN}/icons/pack/weapons/Sword_01.png`,
  },
  "2h_sword": {
    name: "2H Sword",
    icon: "🗡️",
    hand: "2h",
    classes: ["warrior", "ranger"],
    openWeaponId: "greatsword",
    cdnIcon: `${CDN}/icons/pack/weapons/Sword_01.png`,
  },
  axe: {
    name: "1H Axe",
    icon: "🪓",
    hand: "1h",
    classes: ["warrior"],
    openWeaponId: "axe",
    cdnIcon: `${CDN}/icons/pack/weapons/Axe_01.png`,
  },
  "2h_axe": {
    name: "2H Axe",
    icon: "⚒️",
    hand: "2h",
    classes: ["warrior"],
    openWeaponId: "greataxe",
    cdnIcon: `${CDN}/icons/pack/weapons/Axe_01.png`,
  },
  hammer: {
    name: "1H Hammer",
    icon: "🔨",
    hand: "1h",
    classes: ["warrior", "worge"],
    openWeaponId: "hammer",
    cdnIcon: `${CDN}/icons/pack/weapons/Hammer_01.png`,
  },
  "2h_hammer": {
    name: "2H Hammer",
    icon: "🔨",
    hand: "2h",
    classes: ["warrior"],
    openWeaponId: "hammer2h",
    cdnIcon: `${CDN}/icons/pack/weapons/Hammer_01.png`,
  },
  dagger: {
    name: "Dagger",
    icon: "🗡️",
    hand: "1h",
    classes: ["ranger", "worge"],
    openWeaponId: "dagger",
    cdnIcon: `${CDN}/icons/pack/weapons/Dagger_01.png`,
  },
  spear: {
    name: "Spear",
    icon: "🔱",
    hand: "2h",
    classes: ["ranger", "worge"],
    openWeaponId: "spear",
    cdnIcon: `${CDN}/icons/pack/weapons/Spear_01.png`,
  },
  bow: {
    name: "Bow",
    icon: "🏹",
    hand: "2h",
    classes: ["ranger", "worge"],
    openWeaponId: "bow",
    cdnIcon: `${CDN}/icons/pack/weapons/Bow_01.png`,
  },
  crossbow: {
    name: "Crossbow",
    icon: "🏹",
    hand: "2h",
    classes: ["ranger"],
    openWeaponId: "crossbow",
    cdnIcon: `${CDN}/icons/pack/weapons/Crossbow_01.png`,
  },
  gun: {
    name: "Gun",
    icon: "🔫",
    hand: "2h",
    classes: ["ranger"],
    openWeaponId: "rifle",
    cdnIcon: `${CDN}/icons/pack/weapons/Crossbow_01.png`,
  },
  staff: {
    name: "Staff",
    icon: "🪄",
    hand: "2h",
    classes: ["mage", "worge"],
    openWeaponId: "staff",
    cdnIcon: `${CDN}/icons/pack/misc/Flow.png`,
  },
  wand: {
    name: "Wand",
    icon: "✨",
    hand: "1h",
    classes: ["mage"],
    openWeaponId: "wand",
    cdnIcon: `${CDN}/icons/pack/weapons/staff_34.png`,
  },
  mace: {
    name: "Mace",
    icon: "🔨",
    hand: "1h",
    classes: ["mage", "worge"],
    openWeaponId: "mace",
    cdnIcon: `${CDN}/icons/pack/weapons/Hammer_01.png`,
  },
  tome: {
    name: "Tome",
    icon: "📖",
    hand: "oh",
    classes: ["mage"],
    openWeaponId: "tome",
    cdnIcon: `${CDN}/icons/pack/weapons/Book_1.png`,
  },
  offhand_relic: {
    name: "Off-Hand Relic",
    icon: "💎",
    hand: "oh",
    classes: ["mage", "worge"],
    cdnIcon: `${CDN}/icons/pack/misc/Effect.png`,
  },
  shield: {
    name: "Shield",
    icon: "🛡️",
    hand: "oh",
    classes: ["warrior"],
    openWeaponId: "shield",
    cdnIcon: `${CDN}/icons/pack/weapons/Sword_01.png`,
  },
};

function generateWeaponSkills(weaponName: string, wepId: string, cdnIcon?: string): SkillNode[] {
  const baseIcon = cdnIcon || `${CDN}/icons/pack/weapons/Sword_01.png`;
  const rows: Array<Omit<SkillNode, "iconUrl">> = [
    { id: "basic", name: `${weaponName} Basics`, level: 1, desc: `Basic ${weaponName.toLowerCase()} techniques`, bonus: "+5% damage", icon: baseIcon, slot: "primary" },
    { id: "adept", name: `${weaponName} Adept`, level: 5, desc: `Improved ${weaponName.toLowerCase()} handling`, bonus: "+10% damage, +5% speed", icon: baseIcon, slot: "primary" },
    { id: "spec_1", name: `${weaponName} Spec I`, level: 10, desc: `Unlock special ${weaponName.toLowerCase()} ability`, bonus: "Special attack unlocked", icon: `${CDN}/icons/pack/misc/Slash_07.png`, slot: "secondary" },
    { id: "expert", name: `${weaponName} Expert`, level: 15, desc: `Expert ${weaponName.toLowerCase()} techniques`, bonus: "+15% damage, +10% crit", icon: baseIcon, slot: "ability" },
    { id: "spec_2", name: `${weaponName} Spec II`, level: 20, desc: `Advanced ${weaponName.toLowerCase()} ability`, bonus: "Advanced attack unlocked", icon: `${CDN}/icons/pack/misc/Effect.png`, slot: "ability" },
    { id: "master", name: `${weaponName} Mastery`, level: 25, desc: `Mastered ${weaponName.toLowerCase()} combat`, bonus: "+25% damage, +15% crit, special proc", icon: `${CDN}/icons/pack/misc/Flow.png`, slot: "ultimate" },
  ];
  return rows.map((r) => ({
    ...r,
    iconUrl: r.icon,
    id: `${wepId}_${r.id}`,
  }));
}

export const WEAPON_SKILLS: Record<
  string,
  { name: string; icon: string; cdnIcon?: string; skills: SkillNode[] }
> = {};
for (const [id, wep] of Object.entries(WEAPON_TYPES)) {
  WEAPON_SKILLS[id] = {
    name: wep.name,
    icon: wep.icon,
    cdnIcon: wep.cdnIcon,
    skills: generateWeaponSkills(wep.name, id, wep.cdnIcon),
  };
}

export type MasteryTier = { tier: number; name: string; xp: number; bonus: string };

export const MASTERY_TIERS: MasteryTier[] = [
  { tier: 1, name: "Novice", xp: 0, bonus: "None" },
  { tier: 2, name: "Apprentice", xp: 500, bonus: "+3% damage" },
  { tier: 3, name: "Journeyman", xp: 2000, bonus: "+6% damage, +3% speed" },
  { tier: 4, name: "Expert", xp: 5000, bonus: "+10% damage, +5% speed, +5% crit" },
  { tier: 5, name: "Master", xp: 12000, bonus: "+15% damage, +8% speed, +8% crit" },
  { tier: 6, name: "Grandmaster", xp: 25000, bonus: "+20% damage, +10% speed, +12% crit, unique proc" },
  { tier: 7, name: "Legend", xp: 50000, bonus: "+25% all, unique passive + visual effect" },
];

export function getMasteryTier(xp: number): MasteryTier {
  let current = MASTERY_TIERS[0];
  for (const tier of MASTERY_TIERS) {
    if (xp >= tier.xp) current = tier;
    else break;
  }
  return current;
}

export function getMasteryProgress(xp: number): {
  current: MasteryTier;
  next: MasteryTier | null;
  progress: number;
} {
  const current = getMasteryTier(xp);
  const idx = MASTERY_TIERS.indexOf(current);
  const next = MASTERY_TIERS[idx + 1] ?? null;
  if (!next) return { current, next: null, progress: 1 };
  return {
    current,
    next,
    progress: (xp - current.xp) / (next.xp - current.xp),
  };
}

/** Map Open WeaponId → systems weapon type key. */
export function openWeaponToSystemsType(weapon: string | undefined | null): string | null {
  if (!weapon || weapon === "none") return null;
  const map: Record<string, string> = {
    sword: "sword",
    greatsword: "2h_sword",
    gunblade: "sword",
    axe: "axe",
    greataxe: "2h_axe",
    dagger: "dagger",
    spear: "spear",
    javelin: "spear",
    hammer: "hammer",
    hammer2h: "2h_hammer",
    mace: "mace",
    bow: "bow",
    crossbow: "crossbow",
    "hunter-rifle": "gun",
    shotgun: "gun",
    pistol: "gun",
    rifle: "gun",
    staff: "staff",
    staffFire: "staff",
    staffIce: "staff",
    staffStorm: "staff",
    staffNature: "staff",
    staffHoly: "staff",
    wand: "wand",
    tome: "tome",
    scythe: "2h_sword",
    shield: "shield",
  };
  return map[weapon] ?? null;
}
