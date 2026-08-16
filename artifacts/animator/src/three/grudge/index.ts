/**
 * Grudge6 kit — ONE production path only:
 *   loadGrudge6CombatRig(race, preset, opts)  ← mesh + equip + atlas + SI + anims
 *   GrudgeAvatar → same
 *
 * PURGED: 30characters.glb, bakedRoster static heroes, Mixamo fallback for races.
 */

export {
  setAssetBase,
  getAssetBase,
  resolveAssetUrl,
  assetLoadError,
  probeAssetHost,
} from "./assetBase";

export type { RaceId, RaceAsset } from "./raceAssets";
export { RACE_ASSETS, RACE_IDS } from "./raceAssets";

export type { GearPreset, PresetId } from "./gearPresets";
export {
  RACE_GEAR_PRESETS,
  PRESET_IDS,
  getPreset,
  classItemForPreset,
  collectKitSlotMeshes,
  currentKitSlotMesh,
  cycleKitSlot,
  applyBackTemplateToMeshIds,
  isKitBackMesh,
} from "./gearPresets";
export type { KitPanelSlot } from "./gearPresets";
export {
  TOON_WARDROBE,
  TOON_RELICS,
  TOON_CLASS_ITEMS,
  TOON_RINGS,
  META_EQUIP_LABEL,
  UMMORPG_PLAYER_SLOTS,
  UMMORPG_SLOT_TO_KIT,
  reconcileKitLimbs,
  reconcileKitLoadout,
  bodyLimbCover,
  kitSlotGate,
  kitWeaponFamily,
  arsenalIdFromKitWeapon,
} from "./toonKitCoverage";
export {
  resolveSlotEffects,
  effectForEquipId,
  slotEffectLines,
  classIdFromMeshIds,
  classTreeIdFromMeshIds,
  RELIC_SLOT_EFFECTS,
  CLASS_ITEM_EFFECTS,
  BACK_SLOT_EFFECTS,
} from "./slotEffects";
export type { SlotEffectSpec, SlotEffectKind } from "./slotEffects";

export type { GrudgePlaytestEntry } from "./playtestRoster";
export {
  GRUDGE6_PLAYTEST_ROSTER,
  GRUDGE6_RACE_DEFAULTS,
  DEFAULT_PLAYTEST_PRESET,
  buildGrudge6PlaytestRoster,
  grudge6PlaytestByRace,
  isGrudge6PlaytestId,
} from "./playtestRoster";

export type { AnimPack, LoadoutClips } from "./anims";
export {
  ANIM_PACK_CLIPS,
  ANIM_PACK_FALLBACK,
  ANIM_PACK_LABELS,
  CHOOSABLE_ANIM_PACKS,
  PROD_ANIMS_CDN,
  BANNED_LOCOMOTION_CLIPS,
  SPRINT_CLIP,
  SPRINT_LOCO_MULT,
  DUAL_WIELD_CLIPS,
  GHOST_RIDER_CLIPS,
  MOBILITY_CLIPS,
  TRAVERSAL_CLIPS,
  asAnimPack,
  animPackForWeapon,
  resolveAnimPackClips,
  isBannedLocomotionClip,
  isBadLocoClipName,
  isUnsuitableLocoCycle,
  bakedClipUrl,
  resolveBakeRel,
  toRotationOnlyClip,
  loadBakedClip,
} from "./anims";

export type { CombatStyleId, CombatStyleDef } from "./combatStyles";
export {
  COMBAT_STYLES,
  getCombatStyle,
  listCombatStyles,
  loadStoredCombatStyle,
  storeCombatStyle,
  animPackForCombatStyle,
} from "./combatStyles";

// Fleet anim DB + state machine (loco / combat / harvest / swim / climb / mantle)
export {
  getAnimDatabase,
  AnimDatabase,
  AnimStateMachine,
  resolveAnimForSurface,
  bakePathFromRel,
  liveAnimPackForWeapon,
  liveBakeRelsForWeapon,
  pickLiveBakeRel,
  getWeaponLiveDef,
  weaponLiveSummary,
} from "../anim";
export { TwoHandGrip, wantsTwoHandGrip } from "./twoHandGrip";
export {
  SPEAR_SKILLS,
  AXE_SKILLS,
  MACE_SKILLS,
  SHARED_FINISHER_SKILLS,
  CHAIN_RANGED_MELEE_SKILLS,
  familyFromWeaponId,
  familyFromAnimPack,
  skillPackForFamily,
  skillPackForWeaponId,
  skillBakedRole,
  MAGIC_SKILLS,
  SAMURAI_2H_SKILLS,
  GUN_SKILLS,
  SWORD_SKILLS,
} from "./weaponSkillPacks";
export {
  skillPackForStaffWeaponId,
  castingElementToFleetRows,
  CASTING_ELEMENT_PHASE_VFX,
  STAFF_FIRE_SKILLS,
  STAFF_WATER_SKILLS,
  STAFF_EARTH_SKILLS,
  STAFF_WIND_SKILLS,
  STAFF_ARCANE_SKILLS,
} from "./castingElementSkills";
export {
  powerOfTenScale,
  normalizeBoneKey,
  buildBoneNameLookup,
  rematchClipToSkeleton,
  unifySkeletons,
  boneTreeRoot,
  findHandBone,
} from "./skeleton";

export type { LoadedCharacter } from "./loadCharacter";
export {
  loadCharacterModel,
  normalizeCharacterGroup,
  applyGearPreset,
  applyBodyTexture,
  meshKey,
} from "./loadCharacter";

export { loadBodyTexture } from "./texture";

export {
  WARLORDS_ROLES,
  DEFAULT_HOSTILE_ROLES,
  getWarlordsRole,
  warlordsRolesOfKind,
  presetForWeaponKind,
  strategyBiasForPreset,
  pickHostileRole,
  pickHostileRoleForWeapon,
  allHostileRoleIds,
} from "./warlordsRoles";
export type { WarlordsRole, WarlordsRoleKind, RoleStrategyBias, PickHostileRoleOpts } from "./warlordsRoles";

export {
  applyGearVisibility,
  rebindRaceAtlas,
  ensureGrudge6Materials,
  aliasCombatRoles,
  loadGrudge6CombatRig,
  arenaCharacterGlbUrl,
} from "./grudge6Runtime";
export type { LoadGrudge6Opts, Grudge6LoadedRig } from "./grudge6Runtime";

// Scene deploy (Y-up / XZ / art-forward +Z) — used by Studio + loaders
export {
  deployCharacterModel,
  ensureHumanScale,
  groundFeetLocal,
  reGroundAfterEquip,
  reGroundAfterAnimSample,
  diagnoseCharacterLook,
  sampleClipAndReground,
  liftForClipFootClearance,
  findDeployModel,
  validateCharacterDeploy,
  findPelvisBone,
  CHARACTER_ART_FORWARD,
  DEPLOY_TARGET_HEIGHT_M,
} from "../characterDeploy";
