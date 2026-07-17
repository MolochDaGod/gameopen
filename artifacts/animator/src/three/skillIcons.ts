/**
 * Skill / weapon icon resolution for Danger Room HUD.
 *
 * Order: absolute CDN URL → local `/icons/*.png` name → generic fallback.
 * Prefab content ships `cdnUrl`; arsenal weapons map to pack art on R2.
 */
import type { WeaponId } from "./types";
import { WEAPON_ICON, iconUrl, type IconName } from "./icons";
import { asset } from "./assets";

const CDN = "https://assets.grudge-studio.com";

/** Known-good pack icons (audited 200 on R2). Prefer these over 404 variants. */
const WEAPON_CDN: Partial<Record<WeaponId, string>> = {
  sword: `${CDN}/icons/pack/weapons/Sword_01.png`,
  greatsword: `${CDN}/icons/pack/weapons/Sword_01.png`,
  gunblade: `${CDN}/icons/pack/weapons/Sword_01.png`,
  axe: `${CDN}/icons/pack/weapons/Axe_01.png`,
  greataxe: `${CDN}/icons/pack/weapons/Axe_01.png`,
  dagger: `${CDN}/icons/pack/weapons/Dagger_01.png`,
  spear: `${CDN}/icons/pack/weapons/Spear_01.png`,
  javelin: `${CDN}/icons/pack/weapons/Spear_01.png`,
  hammer: `${CDN}/icons/pack/weapons/Hammer_01.png`,
  hammer2h: `${CDN}/icons/pack/weapons/Hammer_01.png`,
  mace: `${CDN}/icons/pack/weapons/Hammer_01.png`,
  bow: `${CDN}/icons/pack/weapons/Bow_01.png`,
  crossbow: `${CDN}/icons/pack/weapons/Crossbow_01.png`,
  "hunter-rifle": `${CDN}/icons/pack/weapons/Crossbow_01.png`,
  shotgun: `${CDN}/icons/pack/weapons/Crossbow_01.png`,
  pistol: `${CDN}/icons/pack/weapons/Crossbow_01.png`,
  rifle: `${CDN}/icons/pack/weapons/Crossbow_01.png`,
  staff: `${CDN}/icons/pack/misc/Flow.png`,
  staffFire: `${CDN}/icons/pack/misc/Effect.png`,
  staffIce: `${CDN}/icons/pack/misc/Flow.png`,
  staffStorm: `${CDN}/icons/pack/misc/Electro.png`,
  staffNature: `${CDN}/icons/pack/misc/Slash_07.png`,
  staffHoly: `${CDN}/icons/pack/misc/Flow.png`,
  wand: `${CDN}/icons/pack/weapons/staff_34.png`,
  tome: `${CDN}/icons/pack/weapons/Book_1.png`,
  scythe: `${CDN}/icons/pack/weapons/Scythe_01.png`,
  shield: `${CDN}/icons/pack/weapons/Sword_01.png`,
  none: `${CDN}/icons/pack/misc/Flow.png`,
};

/** Signature slot flavor icons on CDN (misc pack — verified live where possible). */
const SIG_CDN = [
  `${CDN}/icons/pack/misc/Slash_07.png`,
  `${CDN}/icons/pack/misc/Flow.png`,
  `${CDN}/icons/pack/misc/Effect.png`,
  `${CDN}/icons/pack/misc/Electro.png`,
] as const;

const SIG_LOCAL: IconName[] = ["scout", "ambush", "siege", "skill-vfx-lab"];

/**
 * CraftPix / skill_nobg warrior set — local first (public/icons/skill_nobg),
 * then info.grudge-studio.com ObjectStore. Used for sword, knife/dagger, and
 * other melee skill slots so we stop showing generic slash/flow placeholders.
 */
const WARRIOR_SKILL_HOST = "https://info.grudge-studio.com";
const WARRIOR_SKILL_LOCAL = "/icons/skill_nobg";

function warriorSkillUrl(n: number): string {
  const id = String(Math.max(1, Math.min(50, Math.floor(n)))).padStart(2, "0");
  // Prefer local public copy (shipped with Open); CDN as absolute fallback
  return `${WARRIOR_SKILL_LOCAL}/Warriorskill_${id}_nobg.png`;
}

function warriorSkillCdn(n: number): string {
  const id = String(Math.max(1, Math.min(50, Math.floor(n)))).padStart(2, "0");
  return `${WARRIOR_SKILL_HOST}/icons/skill_nobg/Warriorskill_${id}_nobg.png`;
}

/** Melee weapons that should use warrior skill art for F + 1–4. */
function isWarriorMeleeWeapon(w: WeaponId): boolean {
  return (
    w === "sword" ||
    w === "dagger" ||
    w === "greatsword" ||
    w === "axe" ||
    w === "greataxe" ||
    w === "hammer" ||
    w === "hammer2h" ||
    w === "mace" ||
    w === "scythe" ||
    w === "gunblade" ||
    w === "shield" ||
    w === "none"
  );
}

/**
 * Curated warrior skill icons per role for sword / knife (dagger) kits.
 * Indices map into Warriorskill_XX_nobg (1-based).
 */
const WARRIOR_ROLE_INDEX: Record<SlotIconRole, number> = {
  primary: 1, // basic strike
  fskill: 8, // weapon skill / power
  sig1: 3,
  sig2: 12,
  sig3: 18,
  sig4: 24,
  heavy: 30,
};

/** Sword kit: clearer martial progression icons. */
const SWORD_ROLE_INDEX: Record<SlotIconRole, number> = {
  primary: 1,
  fskill: 5,
  sig1: 7,
  sig2: 14,
  sig3: 22,
  sig4: 28,
  heavy: 35,
};

/** Knife / dagger kit: faster / dual-style warrior skills. */
const DAGGER_ROLE_INDEX: Record<SlotIconRole, number> = {
  primary: 2,
  fskill: 9,
  sig1: 11,
  sig2: 16,
  sig3: 21,
  sig4: 27,
  heavy: 33,
};

function warriorRoleIndex(weapon: WeaponId, role: SlotIconRole): number {
  if (weapon === "sword" || weapon === "gunblade") return SWORD_ROLE_INDEX[role];
  if (weapon === "dagger") return DAGGER_ROLE_INDEX[role];
  return WARRIOR_ROLE_INDEX[role];
}

/** Remap known-broken master paths to live siblings. */
const CDN_REMAP: Record<string, string> = {
  "icons/pack/weapons/Sword_02.png": "icons/pack/weapons/Sword_01.png",
  "icons/pack/weapons/Axe_02.png": "icons/pack/weapons/Axe_01.png",
  "icons/pack/weapons/Dagger_02.png": "icons/pack/weapons/Dagger_01.png",
  "icons/pack/weapons/Dagger_03.png": "icons/pack/weapons/Dagger_01.png",
  "icons/pack/weapons/Arrow_04.png": "icons/pack/weapons/Arrow_01.png",
  "icons/pack/weapons/Arrow_06.png": "icons/pack/weapons/Arrow_01.png",
  "icons/pack/weapons/Bow_05.png": "icons/pack/weapons/Bow_01.png",
  "icons/pack/weapons/Crossbow_03.png": "icons/pack/weapons/Crossbow_01.png",
  "icons/pack/weapons/Crossbow_05.png": "icons/pack/weapons/Crossbow_01.png",
  "icons/pack/weapons/Bolt_01.png": "icons/pack/weapons/Arrow_01.png",
  "icons/pack/weapons/Bolt_05.png": "icons/pack/weapons/Arrow_01.png",
  "icons/pack/weapons/Bolt_08.png": "icons/pack/weapons/Arrow_01.png",
  "icons/pack/weapons/Hammer_05.png": "icons/pack/weapons/Hammer_01.png",
  "icons/pack/misc/Chaos.png": "icons/pack/misc/Chaos_2.png",
  "icons/pack/misc/Power.png": "icons/pack/misc/Effect.png",
  "icons/pack/misc/Glow.png": "icons/pack/misc/Flow.png",
  "icons/pack/misc/NatureFlower.png": "icons/pack/misc/Slash_07.png",
  "icons/pack/misc/AquaCore.png": "icons/pack/misc/Flow.png",
  "icons/pack/misc/AquaCircle.png": "icons/pack/misc/Flow.png",
  "icons/pack/misc/CircleW.png": "icons/pack/misc/Flow.png",
  "icons/pack/misc/ChaosCircle.png": "icons/pack/misc/Chaos_2.png",
};

export function cdnIconUrl(pathOrUrl: string | undefined | null): string | null {
  if (!pathOrUrl) return null;
  let p = String(pathOrUrl).trim();
  if (!p) return null;
  if (/^https?:\/\//i.test(p)) {
    // Already absolute — still apply remap if path suffix known
    const idx = p.indexOf("/icons/");
    if (idx >= 0) {
      const rel = p.slice(idx + 1);
      if (CDN_REMAP[rel]) return `${CDN}/${CDN_REMAP[rel]}`;
    }
    return p;
  }
  p = p.replace(/^\//, "");
  if (CDN_REMAP[p]) p = CDN_REMAP[p];
  return `${CDN}/${p}`;
}

export type SlotIconRole = "primary" | "fskill" | "sig1" | "sig2" | "sig3" | "sig4" | "heavy";

/**
 * Resolve the best icon URL for a HUD action slot.
 * Prefers R2 pack art; always returns a loadable URL (local fallback).
 */
export function resolveSlotIconUrl(
  role: SlotIconRole,
  weapon: WeaponId,
  opts?: { cdnUrl?: string | null; localName?: string | null },
): string {
  // Sword / knife / melee: always prefer warrior skill_nobg art over generic
  // slash/flow placeholders (and over wrong master catalog icons).
  if (isWarriorMeleeWeapon(weapon) && (role === "fskill" || role.startsWith("sig") || role === "heavy")) {
    // Allow explicit good catalog URLs that already point at skill_nobg warrior
    if (opts?.cdnUrl && /Warriorskill_|skill_nobg\/Warrior/i.test(opts.cdnUrl)) {
      const u = cdnIconUrl(opts.cdnUrl);
      if (u) return u;
    }
    return warriorSkillUrl(warriorRoleIndex(weapon, role));
  }
  if (opts?.cdnUrl) {
    const u = cdnIconUrl(opts.cdnUrl);
    // Reject weak generic pack placeholders when we have warrior art for melee
    if (u && isWarriorMeleeWeapon(weapon) && /Slash_07|Flow\.png|Effect\.png|Electro\.png/i.test(u)) {
      return warriorSkillUrl(warriorRoleIndex(weapon, role));
    }
    if (u) return u;
  }
  if (role === "primary") {
    // Keep weapon silhouette for LMB; sword/dagger still get clean pack weapon art
    return WEAPON_CDN[weapon] || iconUrl(WEAPON_ICON[weapon] || "attack");
  }
  if (role === "fskill") {
    if (isWarriorMeleeWeapon(weapon)) return warriorSkillUrl(warriorRoleIndex(weapon, "fskill"));
    return WEAPON_CDN[weapon] || iconUrl(WEAPON_ICON[weapon] || "attack");
  }
  if (role.startsWith("sig")) {
    if (isWarriorMeleeWeapon(weapon)) return warriorSkillUrl(warriorRoleIndex(weapon, role));
    const i = Math.max(0, Math.min(3, Number(role.slice(3)) - 1));
    return SIG_CDN[i] || iconUrl(SIG_LOCAL[i] || "skill-vfx-lab");
  }
  if (role === "heavy") {
    if (isWarriorMeleeWeapon(weapon)) return warriorSkillUrl(warriorRoleIndex(weapon, "heavy"));
    return iconUrl("charge");
  }
  if (opts?.localName) return iconUrl(opts.localName);
  return iconUrl("skill-slot");
}

/** Absolute URL for a warrior skill_nobg icon (1–50). Local public path. */
export function warriorSkillIconUrl(index1Based: number): string {
  return warriorSkillUrl(index1Based);
}

/** CDN fallback if local file 404s (img onError can swap). */
export function warriorSkillIconCdnUrl(index1Based: number): string {
  return warriorSkillCdn(index1Based);
}

/** Local mine-loader style name still used by Icon when only a name is passed. */
export function resolveSlotLocalName(role: SlotIconRole, weapon: WeaponId): IconName | string {
  if (role === "primary" || role === "fskill") return WEAPON_ICON[weapon] || "attack";
  if (role.startsWith("sig")) {
    const i = Math.max(0, Math.min(3, Number(role.slice(3)) - 1));
    return SIG_LOCAL[i] || "skill-vfx-lab";
  }
  if (role === "heavy") return "charge";
  return "skill-slot";
}

/** Content API skill icon helper (future hotbar bind). */
export function contentSkillIcon(skill: { icon?: { cdnUrl?: string; path?: string } } | null): string | null {
  if (!skill?.icon) return null;
  return cdnIconUrl(skill.icon.cdnUrl || skill.icon.path || null);
}

/** Absolute URL for a local public icon (for AI audit messages). */
export function localIconAbsolute(name: string): string {
  return asset(`icons/${name}.png`);
}
