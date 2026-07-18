export {
  CLAIM_FLAG_PLACEABLE,
  CLAIM_PLACEABLES,
  QUICK_CRAFT_PLACEABLES,
  GHOST_BLUE,
  GHOST_RED,
  SMALL_ISLAND_URL,
  SMALL_ISLAND_META,
  getPlaceable,
  listClaimGatedPlaceables,
  listPlaceablesByCategory,
  listAllPlaceables,
  snapToGrid,
  type PlaceableDef,
  type PlaceableCategory,
  type PlaceableBehavior,
  type PlacedStructure,
} from "./placeables";

export { CampBuildSystem, type CampBuildCallbacks } from "./CampBuildSystem";

export {
  CAMP_ASSET_BINDINGS,
  BUILDING_UUID_TO_PLACEABLE,
  getCampAssetBinding,
  resolvePlaceableMeshKeys,
  resolvePlaceableIconKeys,
  applyCanonicalScale,
  type CampAssetType,
  type CampImporter,
  type CampAssetBinding,
} from "./campAssetCatalog";

export {
  loadPlaceableMesh,
  loadCampWorld,
  placeableIconUrl,
  placeableIconCandidates,
  type LoadedCampMesh,
} from "./loadCampAsset";

export {
  describePlaceableFunctions,
  listPlaceableCapabilities,
  type PlaceableCapabilityRow,
} from "./placeableCapabilities";

export {
  bindUnitMesh,
  bindRoleMesh,
  listPrefabUnits,
  listCommanders,
  listTravelers,
  listMerchants,
  heroPrefabFromUnitBind,
  presetForUnitType,
  raceForFaction,
  type UnitMeshBind,
} from "./unitMeshBind";
