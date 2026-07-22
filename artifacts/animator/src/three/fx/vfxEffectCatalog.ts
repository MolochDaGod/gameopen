/**
 * Fantasy VFX Sandbox catalog — mirrors https://vfxgrudge.puter.site/
 * Effect Library (vfx-sandbox-builtin) for fleet combat previews + skill binds.
 *
 * Primary combat preview keys use **Alt** so they never steal C=parry, G=evade, etc.
 */

export type VfxCatalogCategory =
  | "fire"
  | "ice"
  | "lightning"
  | "arcane"
  | "light"
  | "poison"
  | "slash"
  | "earth";

export type VfxCatalogEntry = {
  id: string;
  name: string;
  category: VfxCatalogCategory;
  /** Hex primary color from sandbox panel. */
  color: number;
  description: string;
  tags: string[];
};

/** Full Effect Library from vfxgrudge.puter.site (ids stable for skill binds). */
export const VFX_CATALOG: readonly VfxCatalogEntry[] = [
  {
    id: "chain_lightning",
    name: "Chain Lightning",
    category: "lightning",
    color: 0x7ec8ff,
    description: "Branching lightning arcs between targets.",
    tags: ["lightning", "chain", "burst"],
  },
  {
    id: "inferno",
    name: "Inferno Blast",
    category: "fire",
    color: 0xff6a1e,
    description: "Wide fire explosion with lasting heat.",
    tags: ["fire", "aoe", "blast"],
  },
  {
    id: "fire_aura",
    name: "Fire Aura",
    category: "fire",
    color: 0xff5510,
    description: "Ring of fire around the caster.",
    tags: ["fire", "aura", "buff", "ring"],
  },
  {
    id: "arcane_swirl",
    name: "Arcane Swirl",
    category: "arcane",
    color: 0xb070ff,
    description: "Orbiting arcane motes around the caster.",
    tags: ["arcane", "swirl", "channel"],
  },
  {
    id: "ice_lightning_burst",
    name: "Ice / Lightning Burst",
    category: "ice",
    color: 0x9fdcff,
    description: "Ice Serpent — frost + lightning impact burst.",
    tags: ["ice", "lightning", "burst", "impact"],
  },
  {
    id: "getsuga_slash",
    name: "Getsuga Slash",
    category: "slash",
    color: 0x7dd3fc,
    description: "Crescent slash wave that travels toward the enemy.",
    tags: ["slash", "projectile", "crescent", "getsuga"],
  },
  {
    id: "fireball",
    name: "Fireball",
    category: "fire",
    color: 0xff6a1e,
    description: "Classic lobbed fire projectile.",
    tags: ["fire", "projectile", "bolt"],
  },
  {
    id: "moon_beam",
    name: "Moon Beam",
    category: "light",
    color: 0xd0e8ff,
    description: "Vertical holy / moon light beam.",
    tags: ["light", "holy", "beam"],
  },
  {
    id: "frost_wave",
    name: "Frost Wave",
    category: "ice",
    color: 0x9fdcff,
    description: "Expanding ground frost wave.",
    tags: ["ice", "wave", "slam", "shockwave"],
  },
  {
    id: "fire_wisps",
    name: "Fire Wisps",
    category: "fire",
    color: 0xff9040,
    description: "Orbiting fire wisps around the hand.",
    tags: ["fire", "wisp", "channel"],
  },
  {
    id: "fire_hand",
    name: "Fire Hand",
    category: "fire",
    color: 0xff6020,
    description: "Flaming hand cast tell.",
    tags: ["fire", "hand", "cast"],
  },
  {
    id: "holy_hands",
    name: "Holy Hands",
    category: "light",
    color: 0xffe08a,
    description: "Holy light around both hands.",
    tags: ["holy", "light", "hand"],
  },
  {
    id: "arcane_hands",
    name: "Arcane Hands",
    category: "arcane",
    color: 0xb070ff,
    description: "Arcane glow on caster hands.",
    tags: ["arcane", "hand", "cast"],
  },
  {
    id: "poison_cloud",
    name: "Poison Cloud",
    category: "poison",
    color: 0x7cff3a,
    description: "Lingering toxic cloud AoE.",
    tags: ["poison", "cloud", "aoe"],
  },
  {
    id: "earth_surge",
    name: "Earth Surge",
    category: "earth",
    color: 0xc4a574,
    description: "Ground-read surge / quake (sandbox T) — frost_wave footprint with earth weight.",
    tags: ["earth", "surge", "quake", "wave"],
  },
] as const;

export type VfxEffectId = (typeof VFX_CATALOG)[number]["id"];

export function vfxCatalogById(id: string): VfxCatalogEntry | undefined {
  return VFX_CATALOG.find((e) => e.id === id);
}

/**
 * Sandbox panel primary hotkeys → catalog effectId.
 * In Warlords / Open combat these are bound as **Alt+key** so bare keys stay
 * combat mobility (C dash/parry, G evade, T stomp, V kick, B camera, F skill).
 */
export type VfxSandboxShortcut = {
  /** KeyboardEvent.code without "Key" prefix for display, e.g. "V". */
  key: string;
  /** Full KeyboardEvent.code e.g. "KeyV". */
  code: string;
  label: string;
  effectId: VfxEffectId;
  /** Require Alt (true for combat; false only for pure sandbox). */
  alt: boolean;
};

export const VFX_SANDBOX_SHORTCUTS: readonly VfxSandboxShortcut[] = [
  { key: "V", code: "KeyV", label: "Ice Serpent", effectId: "ice_lightning_burst", alt: true },
  { key: "B", code: "KeyB", label: "Moon Beam", effectId: "moon_beam", alt: true },
  { key: "F", code: "KeyF", label: "Frost Wave", effectId: "frost_wave", alt: true },
  { key: "G", code: "KeyG", label: "Aura Ring", effectId: "fire_aura", alt: true },
  { key: "T", code: "KeyT", label: "Earth Surge", effectId: "earth_surge", alt: true },
  { key: "C", code: "KeyC", label: "Fireball", effectId: "fireball", alt: true },
  // Getsuga is Space on the puter panel — combat uses Alt+Space so jump is free.
  { key: " ", code: "Space", label: "Getsuga Slash", effectId: "getsuga_slash", alt: true },
] as const;

/** Secondary panel keys (learn / optional binds). */
export const VFX_SANDBOX_PANEL_EXTRA: readonly { key: string; label: string; effectId: VfxEffectId | string }[] = [
  { key: "Z", label: "Cast Spell", effectId: "arcane_swirl" },
  { key: "Q", label: "Fire Aura", effectId: "fire_aura" },
  { key: "E", label: "Arcane Swirl", effectId: "arcane_swirl" },
  { key: "R", label: "Ice Burst", effectId: "ice_lightning_burst" },
  { key: "H", label: "Fire Hand", effectId: "fire_hand" },
  { key: "J", label: "Inferno", effectId: "inferno" },
  { key: "O", label: "Meteor", effectId: "inferno" },
  { key: "I", label: "Blizzard", effectId: "frost_wave" },
  { key: "K", label: "Fire Wisps", effectId: "fire_wisps" },
];

/**
 * Production slash variant ids (ice-bow energy projectiles).
 * Prefer importing from `slashProjectileVariants` — re-exported here for hotkeys.
 */
export {
  SLASH_VARIANTS,
  slashVariant,
  slashVariantForColor,
  type SlashVariantId,
} from "./slashProjectileVariants";

/** @deprecated use SLASH_VARIANTS / SlashVariantId */
export const GETSUGA_TINTS = {
  slashred: 0xff5a20,
  slashblue: 0x4aa8ff,
  slashpurple: 0xb070ff,
  slashyellow: 0xffe08a,
  // legacy aliases
  ice: 0x9fdcff,
  blue: 0x4aa8ff,
  purple: 0xb070ff,
  yellow: 0xffe08a,
  red: 0xff5a20,
} as const;

export type GetsugaTint = keyof typeof GETSUGA_TINTS;

/** @deprecated use slashVariantForColor from slashProjectileVariants */
export function getsugaTintForColor(color: number): GetsugaTint {
  // Inline nearest-match to avoid require() in ESM
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  const entries: [GetsugaTint, number][] = [
    ["slashred", 0xff5a20],
    ["slashblue", 0x4aa8ff],
    ["slashpurple", 0xb070ff],
    ["slashyellow", 0xffe08a],
  ];
  let best: GetsugaTint = "slashblue";
  let bestD = Infinity;
  for (const [name, hex] of entries) {
    const tr = ((hex >> 16) & 255) / 255;
    const tg = ((hex >> 8) & 255) / 255;
    const tb = (hex & 255) / 255;
    const d = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}
