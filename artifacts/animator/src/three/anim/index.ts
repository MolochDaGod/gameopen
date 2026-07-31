/**
 * Fleet animation API — database + state machine for loco / combat / harvest /
 * swim / climb / mantle (vertical grab).
 */

export {
  AnimDatabase,
  getAnimDatabase,
  bakePathFromRel,
  type AnimClipEntry,
  type AnimStateDef,
  type AnimPackMeta,
  type AnimResolveQuery,
  type AnimResolveResult,
  type AnimClipStatus,
  type AnimSource,
  type AnimLayer,
  type PlayerActivity,
  type AnimSurface,
} from "./AnimDatabase";

export {
  AnimStateMachine,
  resolveAnimForSurface,
  type AnimActionRequest,
  type AnimMachineInput,
  type AnimMachineOutput,
} from "./AnimStateMachine";

export {
  directionalBlendWeights,
  crossfadeAlpha,
  resolveBlendTime,
  type DirectionalWeights,
} from "./blend";

export {
  getWeaponLiveDef,
  liveAnimPackForWeapon,
  liveBakeRelsForWeapon,
  pickLiveBakeRel,
  weaponLiveSummary,
  sharedTraversalRoles,
  weaponLivePolicy,
  listMappedWeaponIds,
  type WeaponLiveDef,
  type LiveRoleStatus,
} from "./weaponLivePacks";

/** Frame-based Animation Creator + AI clip contract (zip animator tools). */
export { AnimEditor, type AnimEditorState, type BoneInfo, type FrameInfo } from "./AnimEditor";
export {
  buildAnimationClip,
  listStoredClips,
  saveStoredClip,
  getStoredClip,
  deleteStoredClip,
  totalDuration,
  CUSTOM_CLIP_VERSION,
  type ClipFrame,
  type StoredClip,
  type QuatTuple as ClipQuatTuple,
} from "./clipStore";
export {
  normalizeAiClip,
  MAX_FRAMES,
  POSABLE_BONE_SET,
  type AiClip,
  type AiClipFrame,
  type NormalizeResult,
  type QuatTuple as AiQuatTuple,
} from "./aiClipContract";
export { POSABLE_BONES } from "./posableBones";
