// Race asset catalog — vendored from the grudge character-kit (which duplicated
// it from the character-viewer). Textures are lossless `.webp` body atlases.
// Paths are root-relative and resolve via fleet multi-host (R2 + Open):
//   loadCharacterModel / loadBodyTexture walk pathAliases so
//   /assets/… FBX also hits models/grudge6/races/* and textures/grudge6/*.

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
  /** Modular customizable race FBX (R2 /assets + grudge6/races aliases). */
  modelUrl: string;
  /** Body atlas — prefer textures/grudge6 (R2-proven) then assets/… */
  textureUrl: string;
  /** Optional alternate texture keys tried after textureUrl. */
  textureFallbacks?: string[];
}

export const RACE_ASSETS: Record<RaceId, RaceAsset> = {
  barbarians: {
    id: "barbarians",
    name: "Barbarians",
    abbr: "BRB",
    color: "#c2410c",
    modelUrl: "/assets/barbarians/models/characters/BRB_Characters_customizable.FBX",
    textureUrl: "/textures/grudge6/barbarians/BRB_StandardUnits_texture.webp",
    textureFallbacks: ["/assets/barbarians/textures/BRB_StandardUnits_texture.webp"],
  },
  dwarves: {
    id: "dwarves",
    name: "Dwarves",
    abbr: "DWF",
    color: "#b45309",
    modelUrl: "/assets/dwarves/models/characters/DWF_Characters_customizable.FBX",
    textureUrl: "/textures/grudge6/dwarves/DWF_Standard_Units.webp",
    textureFallbacks: ["/assets/dwarves/textures/DWF_Standard_Units.webp"],
  },
  "high-elves": {
    id: "high-elves",
    name: "High Elves",
    abbr: "ELF",
    color: "#0891b2",
    modelUrl: "/assets/elves/models/characters/ELF_Characters_customizable.FBX",
    textureUrl: "/textures/grudge6/elves/ELF_HighElves_Texture.webp",
    textureFallbacks: ["/assets/elves/textures/ELF_HighElves_Texture.webp"],
  },
  orcs: {
    id: "orcs",
    name: "Orcs",
    abbr: "ORC",
    color: "#15803d",
    modelUrl: "/assets/orcs/models/characters/ORC_Characters_Customizable.FBX",
    textureUrl: "/textures/grudge6/orcs/ORC_StandardUnits.webp",
    textureFallbacks: ["/assets/orcs/textures/ORC_StandardUnits.webp"],
  },
  undead: {
    id: "undead",
    name: "Undead",
    abbr: "UD",
    color: "#7c3aed",
    modelUrl: "/assets/undead/models/characters/UD_Characters_customizable.FBX",
    textureUrl: "/textures/grudge6/undead/UD_Standard_Units.webp",
    textureFallbacks: ["/assets/undead/textures/UD_Standard_Units.webp"],
  },
  "western-kingdoms": {
    id: "western-kingdoms",
    name: "W. Kingdoms",
    abbr: "WK",
    color: "#1d4ed8",
    modelUrl: "/assets/western-kingdoms/models/characters/WK_Characters_customizable.FBX",
    textureUrl: "/textures/grudge6/western-kingdoms/WK_Standard_Units.webp",
    textureFallbacks: ["/assets/western-kingdoms/textures/WK_Standard_Units.webp"],
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
