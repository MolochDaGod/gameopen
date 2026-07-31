import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { retargetClip as suRetargetClip } from "three/examples/jsm/utils/SkeletonUtils.js";
import { SKELETON_SOURCE_ID } from "../explorer/clipCatalog";

/**
 * Cross-rig clip retargeting for the Danger Room.
 *
 * Unlike {@link ./importClip}, which only RENAMES tracks (works when the source
 * rig is already Mixamo-topology), this module handles assets whose skeletons
 * differ in bind-pose ORIENTATION and bone NAMING — 3ds-Max Biped (`Bip001 ...`),
 * Bandai (`Body_*`), etc. Those need a real {@link suRetargetClip} pass that bakes
 * the source motion onto our Mixamo skeleton frame by frame.
 *
 * Pipeline per clip:
 *  1. Load our shared skeleton source FBX (the SAME bone hierarchy every
 *     procedural rig clones) as the OFF-SCENE retarget TARGET. retargetClip
 *     mutates `target.skeleton` every frame to read it back, so it must never be
 *     the live displayed character — a fresh load is safe and disposable.
 *  2. Load the source GLB, find its SkinnedMesh, and build an `options.names`
 *     map (TARGET mixamo bone name -> SOURCE bone name) from the per-family
 *     canonical table, tolerating GLTF `_NN` unique-id suffixes and `-`/`_`
 *     separators.
 *  3. Bake with {@link suRetargetClip}; its output tracks are skeleton-form
 *     `.bones[<bone>].quaternion`. We rewrite them to node-form
 *     `<bone>.quaternion` (and drop position -> in-place) so they bind through
 *     the EXACT same path the proven Enel importer uses, on both procedural and
 *     kick-clip rigs.
 *
 * Best-effort: any load/parse failure is swallowed so the rig still works.
 * 3D look is manual-verify only (headless has no WebGL).
 */

/** A real cross-rig retarget fills most of the ~25-bone rig; below this the
 *  family map matched almost nothing, so the clip is dead and we skip it. */
const MIN_RETARGET_TRACKS = 6;

export type RigFamily = "biped" | "bandai";

export interface RetargetSpec {
  /** Source asset, relative to the artifact base (e.g. `anim/imported/ikkaku.glb`). */
  file: string;
  /** Which canonical bone map to use. */
  family: RigFamily;
  /** Source clip name -> registered (display) clip name. */
  clips: { src: string; name: string }[];
}

/**
 * Maps a Mixamo bone CORE name (the part after the `mixamorig` prefix, e.g.
 * `LeftUpLeg`) to the family's canonical bone label (separators normalised to
 * single spaces, `_NN` suffix stripped). Bones absent from the table are left at
 * rest on the retargeted clip.
 */
const FAMILY_MAPS: Record<RigFamily, Record<string, string>> = {
  // 3ds-Max Biped: `Bip001 Pelvis`, `Bip001 L Thigh`, ...
  biped: {
    Hips: "Bip001 Pelvis",
    Spine: "Bip001 Spine",
    Spine1: "Bip001 Spine1",
    Spine2: "Bip001 Spine2",
    Neck: "Bip001 Neck",
    Head: "Bip001 Head",
    LeftShoulder: "Bip001 L Clavicle",
    LeftArm: "Bip001 L UpperArm",
    LeftForeArm: "Bip001 L Forearm",
    LeftHand: "Bip001 L Hand",
    RightShoulder: "Bip001 R Clavicle",
    RightArm: "Bip001 R UpperArm",
    RightForeArm: "Bip001 R Forearm",
    RightHand: "Bip001 R Hand",
    LeftUpLeg: "Bip001 L Thigh",
    LeftLeg: "Bip001 L Calf",
    LeftFoot: "Bip001 L Foot",
    LeftToeBase: "Bip001 L Toe0",
    RightUpLeg: "Bip001 R Thigh",
    RightLeg: "Bip001 R Calf",
    RightFoot: "Bip001 R Foot",
    RightToeBase: "Bip001 R Toe0",
  },
  // Bandai (One Piece) semantic rig: `Body_Pelvis`, `Body_Belly`, `Body_Chest`, ...
  bandai: {
    Hips: "Body Pelvis",
    Spine: "Body Belly",
    Spine1: "Body Chest",
    Neck: "Body Neck",
    Head: "Body Head",
    LeftShoulder: "Body L Shoulder",
    LeftArm: "Body L Arm",
    LeftForeArm: "Body L Elbow",
    LeftHand: "Body L Hand",
    RightShoulder: "Body R Shoulder",
    RightArm: "Body R Arm",
    RightForeArm: "Body R Elbow",
    RightHand: "Body R Hand",
    LeftUpLeg: "Body L Leg",
    LeftLeg: "Body L Knee",
    LeftFoot: "Body L Foot",
    RightUpLeg: "Body R Leg",
    RightLeg: "Body R Knee",
    RightFoot: "Body R Foot",
  },
};

/**
 * Signature clips to harvest. Start with the cleanest Biped rig (Ikkaku) so the
 * SkeletonUtils path + biped bone map can be verified before extending to other
 * families/characters.
 */
export const RETARGET_CLIPS: RetargetSpec[] = [
  {
    file: "anim/imported/ikkaku.glb",
    family: "biped",
    clips: [
      { src: "idle", name: "Ikkaku Idle" },
      { src: "attack1_1", name: "Ikkaku Attack 1" },
      { src: "attack1_2", name: "Ikkaku Attack 2" },
      { src: "attack1_3", name: "Ikkaku Attack 3" },
      { src: "bankai", name: "Ikkaku Bankai" },
    ],
  },
];

const MIXAMO_PREFIX = "mixamorig";

/** Strip a trailing GLTF unique-id suffix and normalise separators to spaces. */
function normalizeSourceName(name: string): string {
  return name
    .replace(/_\d+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findSkinnedMesh(root: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null;
  root.traverse((o) => {
    if (!found && (o as THREE.SkinnedMesh).isSkinnedMesh) found = o as THREE.SkinnedMesh;
  });
  return found;
}

/** Return a SkinnedMesh (with `.skeleton`) for `root`, building one if needed. */
function asSkinned(root: THREE.Object3D): THREE.SkinnedMesh | null {
  const existing = findSkinnedMesh(root);
  if (existing) return existing;
  const bones: THREE.Bone[] = [];
  root.traverse((o) => {
    if ((o as THREE.Bone).isBone) bones.push(o as THREE.Bone);
  });
  if (bones.length === 0) return null;
  const sm = new THREE.SkinnedMesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());
  sm.bind(new THREE.Skeleton(bones));
  return sm;
}

/** Build `{ names, hip }` for {@link suRetargetClip} (TARGET bone -> SOURCE bone). */
function buildNames(
  target: THREE.SkinnedMesh,
  sourceBones: THREE.Bone[],
  family: RigFamily,
): { names: Record<string, string>; hip: string } {
  const map = FAMILY_MAPS[family];
  const srcByNorm = new Map<string, string>();
  for (const b of sourceBones) {
    const norm = normalizeSourceName(b.name);
    if (!srcByNorm.has(norm)) srcByNorm.set(norm, b.name);
  }
  const names: Record<string, string> = {};
  let hip = "";
  for (const tb of target.skeleton.bones) {
    const core = tb.name.startsWith(MIXAMO_PREFIX) ? tb.name.slice(MIXAMO_PREFIX.length) : tb.name;
    const canonical = map[core];
    if (!canonical) continue;
    const srcName = srcByNorm.get(canonical);
    if (!srcName) continue;
    names[tb.name] = srcName;
    if (core === "Hips") hip = srcName;
  }
  return { names, hip };
}

/**
 * Convert SkeletonUtils' skeleton-form output (`.bones[<bone>].quaternion`) into
 * the node-form (`<bone>.quaternion`) the procedural/kick rigs bind through, and
 * drop position tracks so the clip plays in place.
 */
function toNodeForm(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const t of clip.tracks) {
    const m = /^\.bones\[(.+?)\]\.(\w+)$/.exec(t.name);
    if (!m) continue;
    const [, bone, prop] = m;
    if (prop !== "quaternion") continue;
    t.name = `${bone}.${prop}`;
    tracks.push(t);
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

/**
 * Load + retarget every spec in {@link RETARGET_CLIPS} onto our Mixamo skeleton.
 * `baseTrimmed` is the artifact base URL without a trailing slash.
 */
export async function loadRetargetedClips(
  baseTrimmed: string,
): Promise<{ name: string; clip: THREE.AnimationClip }[]> {
  const out: { name: string; clip: THREE.AnimationClip }[] = [];

  // Load the disposable off-scene retarget target (the shared skeleton source).
  // A missing/corrupt source must not break the spawn — bail with no clips.
  let target: THREE.SkinnedMesh | null = null;
  try {
    const fbxLoader = new FBXLoader();
    const skelRoot = await fbxLoader.loadAsync(
      `${baseTrimmed}/anim/${SKELETON_SOURCE_ID}.fbx`,
    );
    target = asSkinned(skelRoot);
  } catch {
    target = null;
  }
  if (!target) return out;

  const gltfLoader = new GLTFLoader();
  for (const spec of RETARGET_CLIPS) {
    try {
      const gltf = await gltfLoader.loadAsync(`${baseTrimmed}/${spec.file}`);
      const scene = gltf.scene;
      const skinned = findSkinnedMesh(scene);
      if (!skinned) continue;
      // retargetClip needs `source.skeleton` for bone lookup AND the bones in the
      // source subtree for its AnimationMixer; the scene root satisfies both once
      // we lend it the SkinnedMesh's skeleton.
      (scene as unknown as { skeleton: THREE.Skeleton }).skeleton = skinned.skeleton;

      const { names, hip } = buildNames(target, skinned.skeleton.bones, spec.family);
      if (!hip || Object.keys(names).length === 0) continue;

      const byName = new Map(gltf.animations.map((a) => [a.name, a]));
      for (const { src, name } of spec.clips) {
        const srcClip = byName.get(src);
        if (!srcClip) continue;
        target.skeleton.pose();
        // `preserveBonePositions` defaults to true at runtime (keeps OUR rig's
        // proportions, copies only rotations); it's absent from the TS typings.
        const baked = suRetargetClip(target, scene, srcClip, { names, hip });
        const node = toNodeForm(baked);
        // Sanity gate: a real retarget yields most of the ~25-bone rig. Too few
        // tracks means the family map matched almost nothing — skip the dead clip.
        if (node.tracks.length >= MIN_RETARGET_TRACKS) out.push({ name, clip: node });
      }
    } catch {
      // Missing asset or parse failure: skip this spec; others still load.
    }
  }
  return out;
}
