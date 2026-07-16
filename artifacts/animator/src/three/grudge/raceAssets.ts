// Race asset catalog — grudge6 / Toon RTS modular kits.
// Production SSOT binaries on R2 CDN (assets.grudge-studio.com).
// Textures: race atlases (webp). flipY=false + MeshStandard in loadBodyTexture.
//
// Delivery contract (see docs/CHARACTER_MESH_DELIVERY.md):
//   mesh  → models/grudge6/races/*_Characters.fbx (FBX SSOT) + GLB fallback
//   atlas → textures/grudge6/{race}/*.webp  (also /assets/{race}/textures/)
//   anims → /anims/baked/* (Open rewrite → arena) then R2
//   equip → child mesh visibility via gear presets / mesh_ids (fuzzy keys)
// 2D UI portraits are separate: public/races/*.png + character.avatarUrl

export type RaceId =
  | "barbarians"
  | "dwarves"
  | "high-elves"
  | "orcs"
  | "undead"
  | "western-kingdoms";

export interface RaceAsset {
  id: RaceId;
  name: string;
  abbr: string;
  color: string;
  /** Modular race kit (FBX SSOT preferred; loaders also try GLB). */
  modelUrl: string;
  /** Body atlas — CDN textures/grudge6 first. */
  textureUrl: string;
  /** Optional alternate texture keys tried after textureUrl. */
  textureFallbacks?: string[];
}

const CDN = "https://assets.grudge-studio.com";

export const RACE_ASSETS: Record<RaceId, RaceAsset> = {
  barbarians: {
    id: "barbarians",
    name: "Barbarians",
    abbr: "BRB",
    color: "#c2410c",
    modelUrl: `${CDN}/models/grudge6/races/BRB_Characters.fbx`,
    textureUrl: `${CDN}/textures/grudge6/barbarians/BRB_StandardUnits_texture.webp`,
    textureFallbacks: [
      "/textures/grudge6/barbarians/BRB_StandardUnits_texture.webp",
      `${CDN}/assets/barbarians/textures/BRB_StandardUnits_texture.webp`,
      "/assets/barbarians/textures/BRB_StandardUnits_texture.webp",
    ],
  },
  dwarves: {
    id: "dwarves",
    name: "Dwarves",
    abbr: "DWF",
    color: "#b45309",
    modelUrl: `${CDN}/models/grudge6/races/DWF_Characters.fbx`,
    textureUrl: `${CDN}/textures/grudge6/dwarves/DWF_Standard_Units.webp`,
    textureFallbacks: [
      "/textures/grudge6/dwarves/DWF_Standard_Units.webp",
      `${CDN}/assets/dwarves/textures/DWF_Standard_Units.webp`,
    ],
  },
  "high-elves": {
    id: "high-elves",
    name: "High Elves",
    abbr: "ELF",
    color: "#0891b2",
    modelUrl: `${CDN}/models/grudge6/races/ELF_Characters.fbx`,
    textureUrl: `${CDN}/textures/grudge6/elves/ELF_HighElves_Texture.webp`,
    textureFallbacks: [
      "/textures/grudge6/elves/ELF_HighElves_Texture.webp",
      `${CDN}/assets/elves/textures/ELF_HighElves_Texture.webp`,
    ],
  },
  orcs: {
    id: "orcs",
    name: "Orcs",
    abbr: "ORC",
    color: "#15803d",
    modelUrl: `${CDN}/models/grudge6/races/ORC_Characters.fbx`,
    textureUrl: `${CDN}/textures/grudge6/orcs/ORC_StandardUnits.webp`,
    textureFallbacks: [
      "/textures/grudge6/orcs/ORC_StandardUnits.webp",
      `${CDN}/assets/orcs/textures/ORC_StandardUnits.webp`,
    ],
  },
  undead: {
    id: "undead",
    name: "Undead",
    abbr: "UD",
    color: "#7c3aed",
    modelUrl: `${CDN}/models/grudge6/races/UD_Characters.fbx`,
    textureUrl: `${CDN}/textures/grudge6/undead/UD_Standard_Units.webp`,
    textureFallbacks: [
      "/textures/grudge6/undead/UD_Standard_Units.webp",
      `${CDN}/assets/undead/textures/UD_Standard_Units.webp`,
    ],
  },
  "western-kingdoms": {
    id: "western-kingdoms",
    name: "W. Kingdoms",
    abbr: "WK",
    color: "#1d4ed8",
    modelUrl: `${CDN}/models/grudge6/races/WK_Characters.fbx`,
    textureUrl: `${CDN}/textures/grudge6/western-kingdoms/WK_Standard_Units.webp`,
    textureFallbacks: [
      "/textures/grudge6/western-kingdoms/WK_Standard_Units.webp",
      `${CDN}/assets/western-kingdoms/textures/WK_Standard_Units.webp`,
    ],
  },
};

export const RACE_IDS: RaceId[] = [
  "barbarians",
  "dwarves",
  "high-elves",
  "orcs",
  "undead",
  "western-kingdoms",
];
