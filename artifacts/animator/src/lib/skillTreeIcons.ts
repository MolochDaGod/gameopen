/**
 * Skill tree node icons — always prefer original catalog paths (icon / iconUrl)
 * from master-skillTrees, master-weaponSkills, bridges, harvest trees, camp skills.
 *
 * Order: explicit iconUrl → icon path → deterministic pack fallback → local RPG glyph.
 */

import { cdnIconUrl } from "../three/skillIcons";
import { iconUrl, type IconName } from "../three/icons";

/** Binaries (pack weapons/misc) — verified on assets CDN. */
const ASSETS_CDN = "https://assets.grudge-studio.com";
/**
 * Skill catalog art (`skill_nobg`, class trees) is served from definitions hosts,
 * NOT assets.grudge-studio.com (probed 404 for skill_nobg on R2, 200 on info).
 */
const SKILL_ICON_HOSTS = [
  "https://info.grudge-studio.com",
  "https://molochdagod.github.io/ObjectStore",
] as const;

/** Paths known to 404 on assets CDN — remap to live pack art. */
const BROKEN_TO_PACK: Record<string, string> = {
  "icons/pack/misc/Flag_01.png": "icons/pack/misc/Naturecircle.png",
  "icons/pack/misc/Flag.png": "icons/pack/misc/Naturecircle.png",
  "icons/pack/misc/Flag_02.png": "icons/pack/misc/Naturecircle.png",
};

export type SkillIconSource = {
  icon?: string | null;
  iconUrl?: string | null;
  id?: string;
  name?: string;
  kind?: string;
  /** Tree id for contextual fallbacks (class-warrior, harvest, weapon-SWORD, camp). */
  treeId?: string;
  classKey?: string;
};

/**
 * Absolute URL for a skill node image.
 * - skill_nobg / skills/class → info ObjectStore (definitions host)
 * - pack / abilities → assets.grudge-studio.com
 * Never returns empty — always a loadable fallback.
 */
export function resolveSkillNodeIconUrl(src: SkillIconSource | null | undefined): string {
  if (!src) return fallbackIconUrl("generic");

  // Prefer iconUrl (catalog SSOT), then icon — both often identical on master trees
  const candidates = [src.iconUrl, src.icon].filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );

  for (const raw of candidates) {
    const t = raw.trim();
    // Emoji / bare glyph — skip (UI may show glyph separately)
    if (isEmojiOrGlyph(t)) continue;
    // Already absolute or relative path under /icons
    if (t.startsWith("http") || t.startsWith("/") || t.startsWith("icons/")) {
      const abs = resolveCatalogIconPath(t);
      if (abs) return abs;
    }
    // Local RPG icon name
    if (!t.includes("/") && !t.includes(".")) {
      return iconUrl(t as IconName);
    }
  }

  return fallbackIconUrl(pickFallbackKey(src));
}

/**
 * Route relative/absolute icon paths to the host that actually serves them.
 * skill_nobg + skills/class → info; pack/abilities → assets R2.
 */
export function resolveCatalogIconPath(pathOrUrl: string): string | null {
  if (!pathOrUrl) return null;
  let p = pathOrUrl.trim();
  if (!p) return null;

  // Absolute URL — fix wrong host for skill_nobg on assets CDN
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p);
      const rel = u.pathname.replace(/^\//, "");
      if (BROKEN_TO_PACK[rel]) {
        return `${ASSETS_CDN}/${BROKEN_TO_PACK[rel]}`;
      }
      if (isSkillCatalogPath(rel) && u.hostname.includes("assets.grudge-studio")) {
        return `${SKILL_ICON_HOSTS[0]}/${rel}`;
      }
      // Still allow skillIcons remap for pack paths
      return cdnIconUrl(p) || p;
    } catch {
      return p;
    }
  }

  p = p.replace(/^\//, "");
  if (BROKEN_TO_PACK[p]) p = BROKEN_TO_PACK[p];

  if (isSkillCatalogPath(p)) {
    return `${SKILL_ICON_HOSTS[0]}/${p}`;
  }

  // Pack / abilities / weapons → assets R2 (+ CDN_REMAP)
  return cdnIconUrl(`/${p}`) || `${ASSETS_CDN}/${p}`;
}

function isSkillCatalogPath(rel: string): boolean {
  const r = rel.replace(/^\//, "").toLowerCase();
  return (
    r.startsWith("icons/skill_nobg/") ||
    r.startsWith("icons/skills/") ||
    r.startsWith("icons/skill/")
  );
}

function absFromRelative(p: string): string {
  const clean = p.replace(/^\//, "");
  if (isSkillCatalogPath(clean)) return `${SKILL_ICON_HOSTS[0]}/${clean}`;
  return `${ASSETS_CDN}/${clean}`;
}

function isEmojiOrGlyph(s: string): boolean {
  if (s.length <= 4 && !s.includes("/") && !s.includes(".")) {
    // likely emoji
    return /[^\x00-\x7F]/.test(s) || s.length <= 2;
  }
  return false;
}

type FallbackKey =
  | "warrior"
  | "mage"
  | "ranger"
  | "worge"
  | "harvest"
  | "craft"
  | "build"
  | "weapon"
  | "camp"
  | "passive"
  | "generic";

function pickFallbackKey(src: SkillIconSource): FallbackKey {
  const tid = (src.treeId || src.classKey || src.id || "").toLowerCase();
  if (tid.includes("warrior") || tid.startsWith("w_")) return "warrior";
  if (tid.includes("mage") || tid.startsWith("m_")) return "mage";
  if (tid.includes("ranger") || tid.startsWith("r_")) return "ranger";
  if (tid.includes("worge") || tid.startsWith("wr_")) return "worge";
  if (tid.includes("harvest") || tid.startsWith("h_")) return "harvest";
  if (tid.includes("craft") || tid.startsWith("c_")) return "craft";
  if (tid.includes("build") || tid.startsWith("b_")) return "build";
  if (tid.includes("weapon") || tid.includes("sword") || tid.includes("bow")) return "weapon";
  if (tid.includes("camp") || tid.startsWith("camp_")) return "camp";
  if (src.kind === "passive" || src.kind === "proc" || src.kind === "bridge") return "passive";
  return "generic";
}

/** Original pack art used when a node has no icon field (still real images, not emoji). */
const FALLBACK_CDN: Record<FallbackKey, string> = {
  warrior: `${SKILL_ICON_HOSTS[0]}/icons/skill_nobg/Warriorskill_01_nobg.png`,
  mage: `${SKILL_ICON_HOSTS[0]}/icons/skill_nobg/Mageskill_01_nobg.png`,
  ranger: `${SKILL_ICON_HOSTS[0]}/icons/skill_nobg/Archerskill_01_nobg.png`,
  worge: `${ASSETS_CDN}/icons/pack/misc/Naturecircle.png`,
  harvest: `${ASSETS_CDN}/icons/pack/misc/Slash_07.png`,
  craft: `${ASSETS_CDN}/icons/pack/misc/Effect.png`,
  build: `${ASSETS_CDN}/icons/pack/misc/Flow.png`,
  weapon: `${ASSETS_CDN}/icons/pack/weapons/Sword_01.png`,
  camp: `${ASSETS_CDN}/icons/pack/misc/Naturecircle.png`,
  passive: `${ASSETS_CDN}/icons/pack/misc/Flow.png`,
  generic: `${ASSETS_CDN}/icons/pack/misc/Effect.png`,
};

function fallbackIconUrl(key: FallbackKey): string {
  return FALLBACK_CDN[key] || FALLBACK_CDN.generic;
}

/**
 * Harvest / camp / bridge nodes often ship without icons — assign stable original paths
 * by node id so every node has art.
 */
export const NODE_ICON_OVERRIDES: Record<string, string> = {
  // Harvest
  h_gather: "/icons/pack/misc/Slash_07.png",
  h_skin: "/icons/pack/misc/Effect.png",
  h_mine: "/icons/pack/weapons/Hammer_01.png",
  h_chop: "/icons/pack/weapons/Axe_01.png",
  h_dig: "/icons/pack/misc/Flow.png",
  h_fish: "/icons/pack/misc/Flow.png",
  h_farm: "/icons/pack/misc/Slash_07.png",
  h_rare: "/icons/pack/misc/Chaos_2.png",
  h_master: "/icons/pack/misc/Effect.png",
  // Crafting
  c_hand: "/icons/pack/misc/Flow.png",
  c_bench: "/icons/pack/misc/Effect.png",
  c_cook: "/icons/pack/misc/Slash_07.png",
  c_forge: "/icons/pack/weapons/Hammer_01.png",
  c_loom: "/icons/pack/misc/Flow.png",
  c_alchemy: "/icons/pack/misc/Chaos_2.png",
  c_batch: "/icons/pack/misc/Effect.png",
  // Building
  b_place: "/icons/pack/misc/Flow.png",
  b_wall: "/icons/pack/misc/Effect.png",
  b_ramp: "/icons/pack/misc/Flow.png",
  b_station: "/icons/pack/weapons/Hammer_01.png",
  b_demo: "/icons/pack/misc/Chaos_2.png",
  b_paint: "/icons/pack/misc/Slash_07.png",
  b_struct: "/icons/pack/misc/Effect.png",
  b_snap: "/icons/pack/misc/Flow.png",
  // Survival / explorer (common ids)
  s_eat: "/icons/pack/misc/Slash_07.png",
  s_light: "/icons/pack/misc/Effect.png",
  s_bag: "/icons/pack/misc/Flow.png",
  s_rest: "/icons/pack/misc/Slash_07.png",
  s_hardy: "/icons/pack/misc/Effect.png",
  e_map: "/icons/pack/misc/Flow.png",
  e_trail: "/icons/pack/misc/Slash_07.png",
  e_avatar: "/icons/pack/misc/Effect.png",
  e_realm: "/icons/pack/misc/Flow.png",
  e_codex: "/icons/pack/misc/Chaos_2.png",
  e_legend: "/icons/pack/misc/Effect.png",
  // Camp account skills
  camp_logistics: "/icons/pack/misc/Flow.png",
  camp_fortify: "/icons/pack/misc/Effect.png",
  camp_muster: "/icons/pack/weapons/Sword_01.png",
  camp_husbandry: "/icons/pack/misc/Slash_07.png",
  camp_drill: "/icons/pack/weapons/Spear_01.png",
  // Class L0 defaults (bridges may omit icons)
  w_l0_warbound: "/icons/skill_nobg/Warriorskill_01_nobg.png",
  m_l0_leyline: "/icons/skill_nobg/Mageskill_01_nobg.png",
  r_l0_log: "/icons/skill_nobg/Archerskill_01_nobg.png",
  wr_l0_bear: "/icons/pack/misc/Naturecircle.png",
};

/** Enrich a node with catalog icon + override if missing. */
export function enrichSkillNodeIcons<T extends SkillIconSource>(node: T, treeId?: string): T {
  const id = node.id || "";
  const override = id ? NODE_ICON_OVERRIDES[id] : undefined;
  let icon = node.iconUrl || node.icon || override || null;
  if (!icon || isEmojiOrGlyph(String(icon))) {
    icon = override || fallbackIconUrl(pickFallbackKey({ ...node, treeId }));
  }
  const abs = resolveSkillNodeIconUrl({
    ...node,
    icon,
    iconUrl: node.iconUrl || icon,
    treeId: treeId || node.treeId,
  });
  return {
    ...node,
    icon: typeof node.icon === "string" && !isEmojiOrGlyph(node.icon) ? node.icon : icon,
    iconUrl: abs,
  };
}

/** Tree header icon (class / harvest / weapon). */
export function resolveTreeHeaderIconUrl(treeId: string, treeIcon?: string | null): string {
  if (treeIcon) {
    const u = resolveSkillNodeIconUrl({ icon: treeIcon, treeId });
    if (u) return u;
  }
  const key = pickFallbackKey({ treeId });
  return fallbackIconUrl(key);
}

/**
 * Extract original icon from master-skillTrees skill object (handles nested forms).
 */
export function pickCatalogIconFields(raw: Record<string, unknown> | null | undefined): {
  icon?: string;
  iconUrl?: string;
} {
  if (!raw) return {};
  const iconUrl =
    (typeof raw.iconUrl === "string" && raw.iconUrl) ||
    (typeof (raw as { icon_url?: string }).icon_url === "string" &&
      (raw as { icon_url?: string }).icon_url) ||
    null;
  const icon =
    (typeof raw.icon === "string" && raw.icon) ||
    (typeof (raw as { iconPath?: string }).iconPath === "string" &&
      (raw as { iconPath?: string }).iconPath) ||
    null;
  // Nested ability / form icons
  const nested =
    (raw.ability as Record<string, unknown> | undefined) ||
    (raw.form as Record<string, unknown> | undefined) ||
    (raw.visual as Record<string, unknown> | undefined);
  const nIcon =
    nested && typeof nested.iconUrl === "string"
      ? nested.iconUrl
      : nested && typeof nested.icon === "string"
        ? nested.icon
        : null;
  return {
    icon: (icon || nIcon || undefined) as string | undefined,
    iconUrl: (iconUrl || nIcon || icon || undefined) as string | undefined,
  };
}
