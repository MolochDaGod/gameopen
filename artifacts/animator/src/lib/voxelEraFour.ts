/**
 * Voxel-era 4-character kit SSOT — `D:\Games\Models\4character` (unzipped).
 *
 * These four GLBs are the play bodies for era=voxel / all GRUDOX cabinets.
 * Not Warlords Toon `models/races/*.glb`. Not a second roster DB.
 *
 * Campfire `/characters` · Foundry `?era=voxel` · GRUDOX `kit=` query.
 */
export const VOXEL_ERA_SLOT_COUNT = 4;

export type VoxelEraKitId = "explorer" | "orc" | "sanji" | "skeleton-warrior";

export type VoxelEraKit = {
  id: VoxelEraKitId;
  slot: 0 | 1 | 2 | 3;
  name: string;
  /** Relative public path — Open `public/` + CDN `assets.grudge-studio.com/` */
  file: string;
  modelYaw: number;
  idleClip?: string;
};

/** Slot order = campfire left → right. */
export const VOXEL_ERA_FOUR: readonly VoxelEraKit[] = [
  {
    id: "explorer",
    slot: 0,
    name: "Explorer",
    file: "models/heroes/hero.glb",
    modelYaw: 0,
    idleClip: "idle",
  },
  {
    id: "orc",
    slot: 1,
    name: "Brute",
    file: "models/orc.glb",
    modelYaw: 0,
    idleClip: "idle",
  },
  {
    id: "sanji",
    slot: 2,
    name: "Striker",
    file: "models/sanji.glb",
    modelYaw: Math.PI,
    idleClip: "Normal Idol",
  },
  {
    id: "skeleton-warrior",
    slot: 3,
    name: "Skeleton",
    file: "models/skeleton-warrior.glb",
    modelYaw: 0,
    idleClip: "idle",
  },
] as const;

const KIT_BY_ID = new Map(VOXEL_ERA_FOUR.map((k) => [k.id, k]));

export function isVoxelEraKitId(id: string | null | undefined): id is VoxelEraKitId {
  return !!id && KIT_BY_ID.has(id as VoxelEraKitId);
}

/** Map fleet baseId / race / remembered animator id → one of the four kits. */
export function resolveVoxelEraKitId(raw: string | null | undefined): VoxelEraKitId {
  const s = String(raw || "").toLowerCase().replace(/_/g, "-");
  if (isVoxelEraKitId(s)) return s;
  if (s.includes("skeleton") || s.includes("undead") || s === "ud") return "skeleton-warrior";
  if (s.includes("sanji") || s.includes("striker") || s.includes("tera-kasi")) return "sanji";
  if (s.includes("orc") || s.includes("brute") || s.includes("barb")) return "orc";
  if (s.includes("explorer") || s.includes("hero") || s.includes("led-monk")) return "explorer";
  return "explorer";
}

export function voxelEraKitById(id: string | null | undefined): VoxelEraKit {
  return KIT_BY_ID.get(resolveVoxelEraKitId(id))!;
}

export function voxelEraKitBySlot(slot: number): VoxelEraKit {
  const i = Math.max(0, Math.min(3, slot | 0)) as 0 | 1 | 2 | 3;
  return VOXEL_ERA_FOUR[i];
}

/** CDN-first then same-origin candidates for a kit GLB. */
export function voxelEraKitUrls(kit: VoxelEraKit, baseUrl = "/"): string[] {
  const rel = kit.file.replace(/^\/+/, "");
  const b = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return [
    `https://assets.grudge-studio.com/${rel}`,
    `${b}${rel}`,
    `/${rel}`,
  ];
}
