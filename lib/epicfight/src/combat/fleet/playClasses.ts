/**
 * Fleet play classes — same contract as Casting `src/combat/playClasses.js`
 * and ObjectStore `api/v1/play-classes.json`.
 */

export const PRODUCT_CLASSES = [
  "warrior",
  "raider",
  "mage",
  "priest",
  "ranger",
  "thief",
  "worge",
  "verduror",
] as const;

export type ProductClassId = (typeof PRODUCT_CLASSES)[number];

export const COLLIDER_CLASSES = [
  "cct",
  "heightfield",
  "convex",
  "trimesh",
  "followConvex",
  "sensor",
  "hurtbox",
] as const;

export type ColliderClassId = (typeof COLLIDER_CLASSES)[number];

export const TRAVEL_CLASSES = ["melee", "bullet", "linear", "bend"] as const;
export type TravelClassId = (typeof TRAVEL_CLASSES)[number];

export const CLASS_PLAY_DEFAULTS: Record<
  ProductClassId,
  { travelMode: TravelClassId; colliderClass: ColliderClassId; pack: string }
> = {
  warrior: { travelMode: "melee", colliderClass: "followConvex", pack: "sword_shield" },
  raider: { travelMode: "melee", colliderClass: "followConvex", pack: "sword_shield" },
  mage: { travelMode: "linear", colliderClass: "sensor", pack: "magic" },
  priest: { travelMode: "linear", colliderClass: "sensor", pack: "magic" },
  ranger: { travelMode: "linear", colliderClass: "followConvex", pack: "longbow" },
  thief: { travelMode: "bullet", colliderClass: "followConvex", pack: "pistol" },
  worge: { travelMode: "melee", colliderClass: "followConvex", pack: "sword_shield" },
  verduror: { travelMode: "bend", colliderClass: "sensor", pack: "magic" },
};

export const PLAY_CLASSES_JSON =
  "https://info.grudge-studio.com/api/v1/play-classes.json";
