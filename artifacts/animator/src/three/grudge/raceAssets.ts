// Race asset catalog — grudge6 / Toon RTS modular kits.
// Production SSOT binaries on R2 CDN (assets.grudge-studio.com).
// Textures: race atlases (webp). flipY=false + MeshStandard in loadBodyTexture.
//
// Delivery contract (docs/CHARACTER_MESH_DELIVERY.md + docs/ANIMATION_FLEET_SSOT.md):
//   mesh  → assets…/asset-packs/toon-rts-characters/glb/characters/{raceId}.glb  (Toon RTS ★ only)
//   atlas → textures/grudge6/{race}/*.webp (embedded-kept preferred; rebind only if stubs)
//   anims → bip001-baked lane only: /anims/baked/* JSON (never Mixamo, never prod/anims GLB)
//   equip → child mesh visibility via gear presets / mesh_ids (fuzzy keys)
// HARD: no browser FBX; no metaverse/*.glb; no races/*_Characters.glb as play default.

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
  /** Modular race kit — Toon RTS GLB ★ only (never FBX in game). */
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
    name: "Barbarian",
    abbr: "BRB",
    color: "#c2410c",
    modelUrl: `${CDN}/asset-packs/toon-rts-characters/glb/characters/barbarian.glb`,
    textureUrl: `${CDN}/textures/grudge6/barbarians/BRB_StandardUnits_texture.webp`,
    textureFallbacks: [
      "/textures/grudge6/barbarians/BRB_StandardUnits_texture.webp",
      `${CDN}/assets/barbarians/textures/BRB_StandardUnits_texture.webp`,
      "/assets/barbarians/textures/BRB_StandardUnits_texture.webp",
    ],
  },
  dwarves: {
    id: "dwarves",
    name: "Dwarf",
    abbr: "DWF",
    color: "#b45309",
    modelUrl: `${CDN}/asset-packs/toon-rts-characters/glb/characters/dwarf.glb`,
    textureUrl: `${CDN}/textures/grudge6/dwarves/DWF_Standard_Units.webp`,
    textureFallbacks: [
      "/textures/grudge6/dwarves/DWF_Standard_Units.webp",
      `${CDN}/assets/dwarves/textures/DWF_Standard_Units.webp`,
    ],
  },
  "high-elves": {
    id: "high-elves",
    name: "Elf",
    abbr: "ELF",
    color: "#0891b2",
    modelUrl: `${CDN}/asset-packs/toon-rts-characters/glb/characters/elf.glb`,
    textureUrl: `${CDN}/textures/grudge6/elves/ELF_HighElves_Texture.webp`,
    textureFallbacks: [
      "/textures/grudge6/elves/ELF_HighElves_Texture.webp",
      `${CDN}/assets/elves/textures/ELF_HighElves_Texture.webp`,
    ],
  },
  orcs: {
    id: "orcs",
    name: "Orc",
    abbr: "ORC",
    color: "#15803d",
    modelUrl: `${CDN}/asset-packs/toon-rts-characters/glb/characters/orc.glb`,
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
    modelUrl: `${CDN}/asset-packs/toon-rts-characters/glb/characters/undead.glb`,
    textureUrl: `${CDN}/textures/grudge6/undead/UD_Standard_Units.webp`,
    textureFallbacks: [
      "/textures/grudge6/undead/UD_Standard_Units.webp",
      `${CDN}/assets/undead/textures/UD_Standard_Units.webp`,
    ],
  },
  "western-kingdoms": {
    id: "western-kingdoms",
    name: "Human",
    abbr: "WK",
    color: "#1d4ed8",
    modelUrl: `${CDN}/asset-packs/toon-rts-characters/glb/characters/human.glb`,
    textureUrl: `${CDN}/textures/grudge6/western-kingdoms/WK_Standard_Units.webp`,
    textureFallbacks: [
      "/textures/grudge6/western-kingdoms/WK_Standard_Units.webp",
      `${CDN}/assets/western-kingdoms/textures/WK_Standard_Units.webp`,
    ],
  },
};

export const RACE_IDS: RaceId[] = [
  "western-kingdoms",
  "barbarians",
  "high-elves",
  "dwarves",
  "orcs",
  "undead",
];
