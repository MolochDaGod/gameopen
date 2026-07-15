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
