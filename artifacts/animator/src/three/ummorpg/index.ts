/**
 * uMMORPG → Grudge Open engine practices
 *
 * - skeletonSockets: Bip001 + hand/shield containers
 * - animationDirector: loco gait + skill one-shots
 * - prefabProfile: NPC/player spawn data (Warlords roles)
 * - scriptableSkills: master-weaponSkills as ScriptableSkill/Weapon
 */
export {
  resolveSkeletonSockets,
  groundFeet,
  attachToSocket,
  listBoneNames,
  validatePrefabSockets,
  type SkeletonSockets,
  type SocketId,
} from "./skeletonSockets";

export {
  AnimationDirector,
  clipsFromRoleMap,
  type DirectorClips,
  type LocoRole,
  type AnimationDirectorOptions,
} from "./animationDirector";

export {
  WEAPON_COMBAT,
  prefabFromWarlordsRole,
  prefabFromRoleId,
  playerPrefab,
  listHostilePrefabs,
  listUnitPrefabs,
  listCommanderPrefabs,
  listTravelerPrefabs,
  presetForWeaponKind,
  type EntityPrefab,
  type PrefabCombatProfile,
  type CombatStyle,
} from "./prefabProfile";

export {
  resolveScriptableWeapon,
  scriptableWeaponFromCache,
  hotbarFromWeapon,
  canCastSkill,
  type ScriptableSkill,
  type ScriptableWeapon,
} from "./scriptableSkills";

export {
  SPEAR_UMMORPG_SKILLS,
  SPEAR_HOTBAR_PREFER,
  SPEAR_ANIM_CLIP,
  SPEAR_COMBO_CLIPS,
  SPEAR_FINISHER_ENTRY_MM,
  isSpearWeapon,
  spearHotbarSkills,
  spearSignatureRows,
  spearChargePlan,
  spearClipForSkillId,
  spearSkillById,
  type SpearSkillRuntime,
  type SpearMotionKind,
} from "./spearCombat";
