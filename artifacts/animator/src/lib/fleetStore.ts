/**
 * Dark Store catalog — fleet games & tools discoverable from Grudge Open.
 * Mix of native Open surfaces and external Grudge Studio destinations.
 */

import { GRUDOX_ZONES, grudoxDeepLink } from "../game/grudoxZones";
import type { AppMode } from "./openRoutes";

export type StoreCategory = "featured" | "combat" | "world" | "tools" | "account";

export interface StoreItem {
  id: string;
  title: string;
  blurb: string;
  category: StoreCategory;
  /** Accent for UI chrome */
  tone: string;
  /** Tag chips */
  tags: readonly string[];
  /** Optional poster under rooms/ */
  poster?: string;
  /** Native Open mode — Play stays in-app */
  nativeMode?: Exclude<AppMode, "doors" | "play">;
  /** External URL builder (token optional later) */
  href?: string;
  /** Free / In library / Launch */
  priceLabel: "Free" | "In library" | "Fleet";
  featured?: boolean;
}

/** Static fleet destinations beyond GRUDOX cabinets. */
const FLEET_LINKS: readonly StoreItem[] = [
  {
    id: "warlord-genesis-web",
    title: "Warlord Genesis",
    blurb: "3-lane MOBA/RTS — launches the real product with your fleet character.",
    category: "combat",
    tone: "#ffd24d",
    tags: ["MOBA", "RTS", "Fleet"],
    poster: "genesis",
    href: "https://warlord-genesis.vercel.app/lobby",
    priceLabel: "In library",
    featured: true,
  },
  {
    id: "danger-room",
    title: "Danger Room",
    blurb: "Full combat sandbox — weapons, skills, training AI.",
    category: "combat",
    tone: "#ff7a7a",
    tags: ["Combat", "Sandbox"],
    poster: "danger",
    nativeMode: "danger",
    priceLabel: "In library",
    featured: true,
  },
  {
    id: "character-studio",
    title: "Character Studio",
    blurb: "Create & equip fleet characters for Warlords era.",
    category: "account",
    tone: "#66c0f4",
    tags: ["Account", "Roster"],
    href: "https://character.grudge-studio.com?era=warlords&from=gameopen",
    priceLabel: "Fleet",
  },
  {
    id: "grudge-id",
    title: "Grudge ID",
    blurb: "Fleet sign-in — one account across Open, GRUDOX, and editors.",
    category: "account",
    tone: "#8ec3ff",
    tags: ["Auth", "SSO"],
    href: "https://id.grudge-studio.com/login",
    priceLabel: "Free",
  },
  {
    id: "grudox-hub",
    title: "GRUDOX Arcade",
    blurb: "Voxel Arcade cabinets — racer, undead, brawler, open world.",
    category: "world",
    tone: "#5fe0ff",
    tags: ["Arcade", "Fleet"],
    poster: "zones",
    href: "https://grudox.grudge-studio.com/",
    priceLabel: "Fleet",
    featured: true,
  },
  {
    id: "lobby-mp",
    title: "The Lobby",
    blurb: "Multiplayer rooms and community maps inside Open.",
    category: "world",
    tone: "#9d8bff",
    tags: ["Multiplayer", "Rooms"],
    poster: "lobby",
    nativeMode: "lobby",
    priceLabel: "In library",
  },
  {
    id: "voxel-editor",
    title: "Voxel Editor",
    blurb: "Author maps, deployables, and dungeon layouts.",
    category: "tools",
    tone: "#7ee0a0",
    tags: ["Create", "Maps"],
    poster: "voxel",
    nativeMode: "voxel",
    priceLabel: "In library",
  },
  {
    id: "dressing-room",
    title: "Dressing Room",
    blurb: "Preview gear, animations, and VFX on your avatar.",
    category: "tools",
    tone: "#ffb24d",
    tags: ["Customize"],
    poster: "dressing",
    nativeMode: "editor",
    priceLabel: "In library",
  },
];

/** Map GRUDOX zones into store cards. */
function zonesAsStore(): StoreItem[] {
  return GRUDOX_ZONES.map((z) => ({
    id: `grudox-${z.id}`,
    title: z.title,
    blurb: z.blurb,
    category: z.id === "racer" || z.id === "voxgrudge" ? ("world" as const) : ("combat" as const),
    tone: z.tone,
    tags: z.native ? (["Native", "Open"] as const) : (["GRUDOX", "Arcade"] as const),
    poster: z.id === "brawler" ? "brawl" : z.id === "voxgrudge" ? "voxgrudge" : "zones",
    nativeMode: z.native ? z.nativeMode : undefined,
    href: z.productionUrl || grudoxDeepLink(z.id),
    priceLabel: z.native ? ("In library" as const) : ("Fleet" as const),
    featured: z.id === "racer" || z.id === "brawler",
  }));
}

/** Deduped full catalog (prefer richer FLEET_LINKS entries over zone dupes). */
export function storeCatalog(): StoreItem[] {
  const zones = zonesAsStore();
  const seen = new Set(FLEET_LINKS.map((i) => i.title.toLowerCase()));
  const extra = zones.filter((z) => !seen.has(z.title.toLowerCase()));
  return [...FLEET_LINKS, ...extra];
}

export const STORE_CATEGORY_LABEL: Record<StoreCategory, string> = {
  featured: "Featured",
  combat: "Combat",
  world: "Worlds & multiplayer",
  tools: "Create & tools",
  account: "Account & identity",
};

export const STORE_CATEGORY_ORDER: StoreCategory[] = [
  "featured",
  "combat",
  "world",
  "tools",
  "account",
];
