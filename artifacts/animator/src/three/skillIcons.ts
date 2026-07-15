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
  "hunter-rifle": `${CDN}/icons/pack/weapons/Crossbow_01.png`,
  pistol: `${CDN}/icons/pack/weapons/Crossbow_01.png`,
  rifle: `${CDN}/icons/pack/weapons/Crossbow_01.png`,
  staff: `${CDN}/icons/pack/misc/Flow.png`,
  staffFire: `${CDN}/icons/pack/misc/Effect.png`,
  staffIce: `${CDN}/icons/pack/misc/Flow.png`,
  staffStorm: `${CDN}/icons/pack/misc/Electro.png`,
  staffNature: `${CDN}/icons/pack/misc/Slash_07.png`,
  staffHoly: `${CDN}/icons/pack/misc/Flow.png`,
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
  if (opts?.cdnUrl) {
    const u = cdnIconUrl(opts.cdnUrl);
    if (u) return u;
  }
  if (role === "primary" || role === "fskill") {
    return WEAPON_CDN[weapon] || iconUrl(WEAPON_ICON[weapon] || "attack");
  }
  if (role.startsWith("sig")) {
    const i = Math.max(0, Math.min(3, Number(role.slice(3)) - 1));
    return SIG_CDN[i] || iconUrl(SIG_LOCAL[i] || "skill-vfx-lab");
  }
  if (role === "heavy") return iconUrl("charge");
  if (opts?.localName) return iconUrl(opts.localName);
  return iconUrl("skill-slot");
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
