import * as THREE from "three";

/**
 * Importer for externally-authored animation clips (dropped FBX/GLB files)
 * retargeted onto our shared 25-bone Mixamo skeleton (`mixamorig:*`).
 *
 * The supported sources all share the Mixamo humanoid HIERARCHY, so retargeting
 * is a deterministic TRACK-NAME REMAP — no SkeletonUtils needed. Each source
 * track's node name is reduced to a core Mixamo bone, then re-emitted under the
 * `mixamorig:` prefix our rigs use. Only QUATERNION tracks are kept (pure
 * rotational retarget, in-place): position/scale tracks are dropped so clips
 * authored at a different unit scale or proportion can't make the character
 * float, sink, or stretch. Tracks that don't map to a core bone (fingers, props
 * like `Sword`, helper nodes) are silently filtered.
 *
 * Truly different rig families (Bandai `Body_*`, 3ds-Max `Bip001`, IK rigs)
 * do NOT share this hierarchy and need a real SkeletonUtils.retargetClip pass;
 * they are intentionally out of scope here.
 *
 * No `@workspace/*` imports (animator artifact rule); three + jsm addons only.
 */

/**
 * Minimum quaternion tracks a remapped clip must have to be considered a real
 * humanoid retarget (root + spine + limbs). Below this the source rig didn't
 * match a known family and the clip is dropped rather than silently dead.
 */
const MIN_RETARGET_TRACKS = 6;

/** The 25 core bones of our shared Mixamo rig (no `mixamorig:` prefix). */
const CORE_BONES = new Set<string>([
  "Hips",
  "Spine",
  "Spine1",
  "Spine2",
  "Neck",
  "Head",
  "HeadTop_End",
  "LeftShoulder",
  "LeftArm",
  "LeftForeArm",
  "LeftHand",
  "RightShoulder",
  "RightArm",
  "RightForeArm",
  "RightHand",
  "LeftUpLeg",
  "LeftLeg",
  "LeftFoot",
  "LeftToeBase",
  "LeftToe_End",
  "RightUpLeg",
  "RightLeg",
  "RightFoot",
  "RightToeBase",
  "RightToe_End",
]);

/**
 * Source rig families this importer can remap by name alone:
 * - `mixamoSuffix`: already `mixamorig:<Bone>_<NN>` (Mixamo export with numeric
 *   node suffixes). Strip the prefix + trailing `_<digits>`.
 * - `mixamoLike`: bare humanoid names with no prefix and `Spine01/Spine02/neck`
 *   spelling (e.g. the Enel retarget FBX). Mapped via {@link MIXAMO_LIKE_MAP}.
 */
export type RemapStrategy = "mixamoSuffix" | "mixamoLike";

/** Bare-name (no prefix) source bone -> our core Mixamo bone. */
const MIXAMO_LIKE_MAP: Record<string, string> = {
  Hips: "Hips",
  Spine: "Spine",
  Spine01: "Spine1",
  Spine02: "Spine2",
  neck: "Neck",
  Neck: "Neck",
  Head: "Head",
  head_end: "HeadTop_End",
  LeftShoulder: "LeftShoulder",
  LeftArm: "LeftArm",
  LeftForeArm: "LeftForeArm",
  LeftHand: "LeftHand",
  RightShoulder: "RightShoulder",
  RightArm: "RightArm",
  RightForeArm: "RightForeArm",
  RightHand: "RightHand",
  LeftUpLeg: "LeftUpLeg",
  LeftLeg: "LeftLeg",
  LeftFoot: "LeftFoot",
  LeftToeBase: "LeftToeBase",
  RightUpLeg: "RightUpLeg",
  RightLeg: "RightLeg",
  RightFoot: "RightFoot",
  RightToeBase: "RightToeBase",
};

/** Reduce a source track's node name to a core Mixamo bone, or null to drop it. */
function coreBoneFor(node: string, strat: RemapStrategy): string | null {
  if (strat === "mixamoSuffix") {
    const bare = node.replace(/^mixamorig:/, "").replace(/_\d+$/, "");
    return CORE_BONES.has(bare) ? bare : null;
  }
  const mapped = MIXAMO_LIKE_MAP[node];
  return mapped && CORE_BONES.has(mapped) ? mapped : null;
}

/**
 * Remap a source clip onto our `mixamorig:` skeleton. Keeps only quaternion
 * tracks whose node maps to a core bone; renames them to `mixamorig:<bone>`.
 */
export function remapImportedClip(
  src: THREE.AnimationClip,
  strat: RemapStrategy,
  name: string,
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const track of src.tracks) {
    const dot = track.name.lastIndexOf(".");
    if (dot < 0) continue;
    const node = track.name.slice(0, dot);
    const prop = track.name.slice(dot + 1);
    if (prop !== "quaternion") continue; // rotational retarget only
    const core = coreBoneFor(node, strat);
    if (!core) continue;
    const cloned = track.clone();
    cloned.name = `mixamorig:${core}.quaternion`;
    tracks.push(cloned);
  }
  return new THREE.AnimationClip(name, src.duration, tracks);
}

/** One importable clip: where it lives + how to remap its rig. */
export interface ImportedClipSpec {
  /** Stable id surfaced in the Clips panel + slot binding. */
  name: string;
  /** Path under the artifact public root (no leading slash). */
  file: string;
  format: "fbx" | "glb";
  strategy: RemapStrategy;
}

/**
 * The dropped clips wired in for the first retarget slice. Enel uses the
 * Mixamo-like FBX; the two attack combos are Mixamo exports with numeric
 * suffixes.
 */
export const IMPORTED_CLIPS: ImportedClipSpec[] = [
  { name: "enel-combo", file: "anim/imported/enel-combo.fbx", format: "fbx", strategy: "mixamoLike" },
  { name: "attack-combo-01", file: "anim/imported/attack-combo-01.glb", format: "glb", strategy: "mixamoSuffix" },
  { name: "attack-combo-02", file: "anim/imported/attack-combo-02.glb", format: "glb", strategy: "mixamoSuffix" },
];

/**
 * Load + remap every {@link IMPORTED_CLIPS} entry. Best-effort: a missing or
 * malformed file is skipped (logged-free) rather than failing the batch.
 * `baseTrimmed` is the artifact base URL without a trailing slash.
 */
export async function loadImportedClips(
  baseTrimmed: string,
): Promise<{ name: string; clip: THREE.AnimationClip }[]> {
  const out: { name: string; clip: THREE.AnimationClip }[] = [];
  for (const spec of IMPORTED_CLIPS) {
    try {
      const url = `${baseTrimmed}/${spec.file}`;
      let raw: THREE.AnimationClip | undefined;
      if (spec.format === "fbx") {
        const { FBXLoader } = await import("three/examples/jsm/loaders/FBXLoader.js");
        raw = (await new FBXLoader().loadAsync(url)).animations[0];
      } else {
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        raw = (await new GLTFLoader().loadAsync(url)).animations[0];
      }
      if (!raw) continue;
      const clip = remapImportedClip(raw, spec.strategy, spec.name);
      // Sanity gate: a valid humanoid retarget must drive the root + a useful
      // number of bones. Too few tracks means the source rig didn't match either
      // family (wrong bone names), so the clip would "exist" but barely animate —
      // skip it (with a dev-only warning) instead of registering a dead clip.
      const hasRoot = clip.tracks.some((t) => t.name === "mixamorig:Hips.quaternion");
      if (hasRoot && clip.tracks.length >= MIN_RETARGET_TRACKS) {
        out.push({ name: spec.name, clip });
      } else if (import.meta.env?.DEV) {
        console.warn(
          `[importClip] "${spec.name}" remapped to ${clip.tracks.length} track(s)` +
            `${hasRoot ? "" : " (no Hips)"} — below threshold, skipping.`,
        );
      }
    } catch {
      // Missing/failed import — skip; the rest still load.
    }
  }
  return out;
}
