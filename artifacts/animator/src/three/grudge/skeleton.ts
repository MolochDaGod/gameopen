import * as THREE from "three";
import { filterBindableTracks } from "../clipTracks";

// Order-of-magnitude unit correction. Ported from the grudge character-viewer
// (powerOfTenScale).
export function powerOfTenScale(reference: number, current: number): number {
  if (!(reference > 0) || !(current > 0)) return 1;
  return Math.pow(10, Math.round(Math.log10(reference / current)));
}

/** Normalize bone name for space↔underscore Bip001 matching. */
export function normalizeBoneKey(name: string): string {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/^mixamorig\d*:/i, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Alias map: spaced/underscore forms → actual scene bone name. */
export function buildBoneNameLookup(root: THREE.Object3D): Map<string, string> {
  const lookup = new Map<string, string>();
  root.traverse((node) => {
    const isBone = (node as THREE.Bone).isBone === true;
    if (!isBone && !/bip001|container|hand|pelvis|spine/i.test(node.name)) return;
    const actual = node.name;
    if (!actual) return;
    lookup.set(actual, actual);
    lookup.set(normalizeBoneKey(actual), actual);
    if (actual.includes("_")) {
      const spaced = actual.replace(/^Bip001_/, "Bip001 ").replace(/_/g, " ");
      lookup.set(spaced, actual);
      lookup.set(normalizeBoneKey(spaced), actual);
    }
    if (actual.includes(" ")) {
      const underscored = actual.replace(/ /g, "_");
      lookup.set(underscored, actual);
      lookup.set(normalizeBoneKey(underscored), actual);
    }
  });
  return lookup;
}

/**
 * Rematch baked-clip tracks onto the live skeleton (Arena = underscores,
 * many JSON packs = spaces). Without this, clips bind zero bones → T-pose.
 */
export function rematchClipToSkeleton(
  root: THREE.Object3D,
  clip: THREE.AnimationClip,
): THREE.AnimationClip {
  const lookup = buildBoneNameLookup(root);
  if (lookup.size === 0) return filterBindableTracks(root, clip);

  let rewritten = 0;
  const tracks: THREE.KeyframeTrack[] = [];
  for (const track of clip.tracks) {
    const parsed = THREE.PropertyBinding.parseTrackName(track.name);
    const nodeName = parsed.nodeName;
    if (!nodeName) {
      tracks.push(track);
      continue;
    }
    const resolved = lookup.get(nodeName) || lookup.get(normalizeBoneKey(nodeName)) || null;
    if (!resolved) {
      if (THREE.PropertyBinding.findNode(root, nodeName) != null) tracks.push(track);
      continue;
    }
    if (resolved !== nodeName) {
      rewritten++;
      const dot = track.name.indexOf(".");
      const propSuffix = dot >= 0 ? track.name.slice(dot) : `.${parsed.propertyName || "quaternion"}`;
      const Ctor = track.constructor as new (
        name: string,
        times: ArrayLike<number>,
        values: ArrayLike<number>,
      ) => THREE.KeyframeTrack;
      tracks.push(
        new Ctor(
          `${resolved}${propSuffix}`,
          (track.times as Float32Array).slice(),
          (track.values as Float32Array).slice(),
        ),
      );
    } else {
      tracks.push(track);
    }
  }
  if (tracks.length === 0) return clip;
  const next =
    tracks.length === clip.tracks.length && rewritten === 0
      ? clip
      : new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
  if (rewritten > 0) {
    console.info(
      `[grudge-kit] rematchClipToSkeleton "${clip.name}": rewrote ${rewritten}/${clip.tracks.length}`,
    );
  }
  return filterBindableTracks(root, next);
}

// Skeleton unification. The Toon_RTS customizable FBX ships each of its ~27
// SkinnedMeshes with its OWN skeleton referencing DISCONNECTED duplicate bone
// instances, so no animation clip can deform the mesh. Fix: collapse every
// SkinnedMesh onto ONE canonical skeleton — the shallowest bone-node per name
// (BFS from root) — reusing each mesh's original boneInverses/bindMatrix.
// Returns the widest resulting skeleton.
export function unifySkeletons(root: THREE.Object3D): THREE.Skeleton | null {
  root.updateMatrixWorld(true);
  const canon = new Map<string, THREE.Bone>();
  const queue: THREE.Object3D[] = [...root.children];
  while (queue.length) {
    const node = queue.shift()!;
    if (node instanceof THREE.Bone && !canon.has(node.name)) canon.set(node.name, node);
    queue.push(...node.children);
  }
  if (canon.size === 0) return null;

  let widest: THREE.Skeleton | null = null;
  let unresolved = 0;
  root.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh && node.skeleton) {
      const newBones = node.skeleton.bones.map((b) => {
        const c = canon.get(b.name);
        if (!c) unresolved++;
        return c ?? b;
      });
      const newSkel = new THREE.Skeleton(newBones, node.skeleton.boneInverses);
      node.bind(newSkel, node.bindMatrix);
      if (!widest || newSkel.bones.length > widest.bones.length) widest = newSkel;
    }
  });
  if (unresolved > 0) {
    console.warn(
      `[grudge-kit] unifySkeletons: ${unresolved} bone(s) had no canonical match; ` +
        `those regions may not deform.`,
    );
  }
  return widest;
}

// Resolve a character's hand bone for weapon attachment. All six races use the
// unified Bip001 rig (exact "Bip001_R_Hand" / "Bip001_L_Hand"), tried first; a
// fuzzy fallback handles non-standard skeletons. Finger/thumb bones excluded.
export function findHandBone(root: THREE.Object3D, side: "L" | "R"): THREE.Object3D | null {
  const exact = side === "R" ? "Bip001_R_Hand" : "Bip001_L_Hand";
  let exactHit: THREE.Object3D | null = null;
  let fuzzyHit: THREE.Object3D | null = null;
  let fuzzyName = "";
  const want = side === "R" ? /rhand|righthand|handr|rwrist/ : /lhand|lefthand|handl|lwrist/;
  const isFinger = /finger|thumb|index|middle|ring|pinky|pinkie|metacarp|digit/;
  root.traverse((node) => {
    if (exactHit) return;
    if (node.name === exact) {
      exactHit = node;
      return;
    }
    const norm = node.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!want.test(norm) || isFinger.test(norm)) return;
    if (!fuzzyHit || norm.length < fuzzyName.length) {
      fuzzyHit = node;
      fuzzyName = norm;
    }
  });
  return exactHit ?? fuzzyHit;
}
