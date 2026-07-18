/**
 * Verified placeable capability matrix — selection UIs, asset type, importer,
 * trainables, and runtime functions attached to each buildable.
 */

import { CLAIM_PLACEABLES, type PlaceableDef } from "./placeables";
import { getCampAssetBinding, type CampAssetType, type CampImporter } from "./campAssetCatalog";

export type PlaceableCapabilityRow = {
  id: string;
  name: string;
  category: string;
  claimGated: boolean;
  assetType: CampAssetType | "unknown";
  importer: CampImporter | "unknown";
  fileTypes: string[];
  meshKeys: string[];
  iconKeys: string[];
  behavior: string;
  /** Runtime functions provided after deploy. */
  functions: string[];
  /** Unit types this building can train (if any). */
  trainable: string[];
  /** UIs that can select / place this. */
  selectionUIs: string[];
  buildingUuid?: string;
};

function functionsFor(def: PlaceableDef): string[] {
  const b = def.behavior || "static";
  switch (b) {
    case "door":
      return ["interact_E_open_close", "animation_mixer_if_clips", "blue_ghost", "solid_textured"];
    case "gate":
      return ["interact_E_open_close", "animation_mixer_if_clips", "blue_ghost", "solid_textured"];
    case "tower":
      return ["auto_aim_hostiles", "area_damage_pulse", "blue_ghost", "solid_textured"];
    case "trap":
      return ["armed_radius_damage", "blue_ghost", "solid_textured"];
    case "npc_spawn":
      return [
        "spawn_npc_slot",
        "train_units_ui",
        `train_${def.npcHint || "unit"}`,
        "blue_ghost",
        "solid_textured",
      ];
    case "workbench":
      if (def.id === "profession_table") {
        return [
          "interact_E_profession",
          "cooking_recipes",
          "fishing_prep_gut_bait",
          "blue_ghost",
          "solid_textured",
        ];
      }
      return ["interact_E_production", "open_production_shell_P", "blue_ghost", "solid_textured"];
    case "harvest_node":
      return ["harvest_mode_yield", "blue_ghost_or_disc", "solid_or_procedural"];
    case "building":
      return ["deployed_structure", "blue_ghost", "solid_textured"];
    default:
      return ["place_static", "blue_ghost", "solid_textured_or_procedural"];
  }
}

function selectionUIsFor(def: PlaceableDef): string[] {
  const uis = ["B_claim_buildings"];
  if (def.category === "defensive" || def.category === "trap") uis.push("B_claim_defensives");
  if (def.category === "farming") uis.push("B_claim_farming");
  if (def.category === "taming") uis.push("B_claim_taming");
  if (def.category === "production") uis.push("B_claim_production_halls");
  if (def.category === "quick_craft") uis.push("field_quick_craft");
  if (def.category === "territory") uis.push("Q_build_radial_flag");
  // Build radial mappings (Studio toolToPlaceable)
  const radialIds = new Set([
    "claim_flag",
    "wall",
    "barracks",
    "archery",
    "door",
    "gate",
    "watchtower",
    "bear_trap",
    "work_bench",
    "profession_table",
    "bridge_long",
    "bridge_short",
    "bridge_pontoon",
    "fish_bucket",
    "miner_forge",
    "farm_plot",
    "storage_chest",
  ]);
  if (radialIds.has(def.id) || def.id === "claim_flag") uis.push("Q_build_radial");
  if (def.behavior === "npc_spawn") uis.push("B_claim_units_train");
  return uis;
}

export function listPlaceableCapabilities(): PlaceableCapabilityRow[] {
  return CLAIM_PLACEABLES.map((def) => {
    const bind = getCampAssetBinding(def.id);
    const meshKeys = bind?.meshKeys?.length
      ? bind.meshKeys
      : def.meshUrl
        ? [def.meshUrl.replace(/^\//, "")]
        : [];
    const iconKeys = bind?.iconKeys?.length
      ? bind.iconKeys
      : def.iconUrl
        ? [def.iconUrl.replace(/^\//, "")]
        : [];
    const importer = bind?.importer ?? (meshKeys.length ? "gltf" : "procedural");
    const fileTypes: string[] = [];
    if (importer === "gltf" || meshKeys.some((k) => /\.glb$/i.test(k))) fileTypes.push("glb");
    if (importer === "fbx") fileTypes.push("fbx");
    if (importer === "procedural") fileTypes.push("procedural");
    if (iconKeys.length) fileTypes.push("png_icon");

    return {
      id: def.id,
      name: def.name,
      category: def.category,
      claimGated: def.claimGated,
      assetType: bind?.assetType ?? "unknown",
      importer,
      fileTypes,
      meshKeys,
      iconKeys,
      behavior: def.behavior || "static",
      functions: functionsFor(def),
      trainable: def.producesTypes?.slice() ?? [],
      selectionUIs: selectionUIsFor(def),
      buildingUuid: def.buildingUuid || bind?.buildingUuid,
    };
  });
}

export function describePlaceableFunctions(placeableId: string): string[] {
  const def = CLAIM_PLACEABLES.find((p) => p.id === placeableId);
  if (!def) return [];
  return functionsFor(def);
}
