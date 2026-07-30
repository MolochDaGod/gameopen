// Vendored Grudge character-kit — framework-agnostic (three only) helpers and
// data for spawning the equipment-driven Toon_RTS character inside the Animator.
// The Animator forbids `@workspace` imports, so this is a local copy of the
// grudge-game character-kit; keep the DATA (RACE_ASSETS, RACE_GEAR_PRESETS) in
// lockstep with the source if it ever changes.

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
export { RACE_GEAR_PRESETS, PRESET_IDS, getPreset } from "./gearPresets";

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
  asAnimPack,
  animPackForWeapon,
  resolveAnimPackClips,
  isBannedLocomotionClip,
  isBadLocoClipName,
  isUnsuitableLocoCycle,
  bakedClipUrl,
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
  familyFromWeaponId,
  familyFromAnimPack,
  skillPackForFamily,
  SAMURAI_2H_SKILLS,
} from "./weaponSkillPacks";
export {
  powerOfTenScale,
  normalizeBoneKey,
  buildBoneNameLookup,
  rematchClipToSkeleton,
  unifySkeletons,
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
  findDeployModel,
  validateCharacterDeploy,
  findPelvisBone,
  CHARACTER_ART_FORWARD,
  DEPLOY_TARGET_HEIGHT_M,
} from "../characterDeploy";
