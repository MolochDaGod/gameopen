/**
 * Fishing + cooking profession assets from human-props stylized pack.
 *
 * Source pack: human_props_-_stylized_low_poly_asset.glb (artikora / CC-BY)
 * Split GLBs: models/props/human-props/*
 */

export type FishingToolId = "fishing_pole" | "fishing_pole_cast";

export type FishingToolDef = {
  id: FishingToolId;
  name: string;
  /** Mesh for held / rack display */
  meshKey: string;
  /** Source node in pack */
  sourceNode: string;
  /** Idle vs line-cast pose */
  pose: "idle" | "cast";
  /** World height target (m) */
  heightM: number;
  /** Profession skills this tool feeds */
  professions: Array<"fishing" | "cooking">;
  blurb: string;
};

export const FISHING_TOOLS: readonly FishingToolDef[] = [
  {
    id: "fishing_pole",
    name: "Fishing Pole",
    meshKey: "models/props/human-props/fishing-pole.glb",
    sourceNode: "Rod_2",
    pose: "idle",
    heightM: 1.75,
    professions: ["fishing"],
    blurb: "Stowed / idle pole — equip for shoreline cast start.",
  },
  {
    id: "fishing_pole_cast",
    name: "Fishing Pole (Line Cast)",
    meshKey: "models/props/human-props/fishing-pole-cast.glb",
    sourceNode: "Rod_1",
    pose: "cast",
    heightM: 1.85,
    professions: ["fishing"],
    blurb: "Pole with line cast pose — active fishing / bobber out.",
  },
] as const;

export const FISHING_BUCKET = {
  id: "fish_bucket",
  name: "Fish Bucket",
  meshKey: "models/props/human-props/bucket.glb",
  sourceNode: "Bucket",
  capacity: 12,
  blurb: "Hold catch / water for cooking station.",
} as const;

export const PROFESSION_TABLE = {
  id: "profession_table",
  name: "Cook & Fish Table",
  meshKey: "models/props/human-props/profession-table.glb",
  sourceNode: "Sundial",
  /** White table / sundial pedestal used as dual profession station */
  professions: ["cooking", "fishing"] as const,
  recipes: [
    { id: "gut_fish", label: "Gut Fish", needs: ["raw_fish"], out: "fish_fillet" },
    { id: "cook_fillet", label: "Cook Fillet", needs: ["fish_fillet", "fuel"], out: "cooked_fish" },
    { id: "bait_mix", label: "Mix Bait", needs: ["forage"], out: "bait" },
    { id: "repair_line", label: "Repair Line", needs: ["fiber"], out: "fishing_line" },
  ],
  blurb: "Cooking + fishing profession table (white table mesh).",
} as const;

export const BUILDABLE_BRIDGES = [
  {
    id: "bridge_long",
    name: "Long Bridge",
    meshKey: "models/props/human-props/bridge-long.glb",
    sourceNode: "Long_bridge",
    spanM: 2.8,
  },
  {
    id: "bridge_short",
    name: "Short Bridge",
    meshKey: "models/props/human-props/bridge-short.glb",
    sourceNode: "Short_bridge",
    spanM: 2.2,
  },
  {
    id: "bridge_pontoon",
    name: "Pontoon Bridge",
    meshKey: "models/props/human-props/bridge-pontoon.glb",
    sourceNode: "Pontoon",
    spanM: 2.4,
  },
] as const;

export const HUMAN_PROPS_PACK = {
  id: "human-props-stylized",
  sourcePath: "C:/Users/nugye/Documents/human_props_-_stylized_low_poly_asset.glb",
  publicPack: "models/props/human-props/human-props-pack.glb",
  catalog: "models/props/human-props/catalog.json",
  license: "CC-BY-4.0",
  author: "artikora",
  sketchfab:
    "https://sketchfab.com/3d-models/human-props-stylized-low-poly-asset-1c46667be09944e0b7c0d53dc1bdc49f",
} as const;

export function fishingToolById(id: string): FishingToolDef | undefined {
  return FISHING_TOOLS.find((t) => t.id === id);
}
