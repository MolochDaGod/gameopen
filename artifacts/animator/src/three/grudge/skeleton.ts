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

/**
 * Canonical humanoid aliases so Bip001 bake tracks bind Mixamo Explorer bones
 * and vice-versa (fleet SSOT: same roles, different name styles).
 */
const BIP001_MIXAMO_ALIASES: Array<[string, string]> = [
  ["bip001pelvis", "mixamorighips"],
  ["bip001spine", "mixamorigspine"],
  ["bip001spine1", "mixamorigspine1"],
  ["bip001spine2", "mixamorigspine2"],
  ["bip001neck", "mixamorigneck"],
  ["bip001head", "mixamorighead"],
  ["bip001lclavicle", "mixamorigleftshoulder"],
  ["bip001lupperarm", "mixamorigleftarm"],
  ["bip001lforearm", "mixamorigleftforearm"],
  ["bip001lhand", "mixamoriglefthand"],
  ["bip001rclavicle", "mixamorigrightshoulder"],
  ["bip001rupperarm", "mixamorigrightarm"],
  ["bip001rforearm", "mixamorigrightforearm"],
  ["bip001rhand", "mixamorigrighthand"],
  ["bip001lthigh", "mixamorigleftupleg"],
  ["bip001lcalf", "mixamorigleftleg"],
  ["bip001lfoot", "mixamorigleftfoot"],
  ["bip001ltoe0", "mixamoriglefttoebase"],
  ["bip001rthigh", "mixamorigrightupleg"],
  ["bip001rcalf", "mixamorigrightleg"],
  ["bip001rfoot", "mixamorigrightfoot"],
  ["bip001rtoe0", "mixamorigrighttoebase"],
  // bare Mixamo
  ["hips", "mixamorighips"],
  ["lefthand", "mixamoriglefthand"],
  ["righthand", "mixamorigrighthand"],
];

/** Alias map: spaced/underscore forms → actual scene bone name. */
export function buildBoneNameLookup(root: THREE.Object3D): Map<string, string> {
  const lookup = new Map<string, string>();
  const actualByKey = new Map<string, string>();
  root.traverse((node) => {
    const isBone = (node as THREE.Bone).isBone === true;
    if (!isBone && !/bip001|mixamo|container|hand|pelvis|spine|hips/i.test(node.name)) return;
    const actual = node.name;
    if (!actual) return;
    lookup.set(actual, actual);
    const key = normalizeBoneKey(actual);
    lookup.set(key, actual);
    actualByKey.set(key, actual);
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
  // Cross-link Bip001 ↔ Mixamo so dual_wield / sword_shield bakes drive Explorer
  for (const [a, b] of BIP001_MIXAMO_ALIASES) {
    const boneA = actualByKey.get(a);
    const boneB = actualByKey.get(b);
    if (boneA && !lookup.has(b)) lookup.set(b, boneA);
    if (boneB && !lookup.has(a)) lookup.set(a, boneB);
    // Also allow clip track "Bip001 R Hand" → mixamorigRightHand when skeleton is Mixamo
    if (boneB) {
      lookup.set(a, boneB);
    }
    if (boneA) {
      lookup.set(b, boneA);
    }
  }
  return lookup;
}

/**
 * Rematch baked-clip tracks onto the live skeleton (Arena = underscores,
 * many JSON packs = spaces). Without this, clips bind zero bones → T-pose.
 *
 * After name rematch, **position tracks are stripped** (rotation-only) so
 * grounded grudge6 kits do not sink feet / stretch limbs from foreign bind poses.
 */
export function rematchClipToSkeleton(
  root: THREE.Object3D,
  clip: THREE.AnimationClip,
  opts?: { stripPositions?: boolean },
): THREE.AnimationClip {
  const stripPos = opts?.stripPositions !== false;
  const lookup = buildBoneNameLookup(root);
  if (lookup.size === 0) {
    const filtered = filterBindableTracks(root, clip);
    return stripPos ? stripPositionAndScaleTracks(filtered) : filtered;
  }

  let rewritten = 0;
  const tracks: THREE.KeyframeTrack[] = [];
  for (const track of clip.tracks) {
    // Grounded kits: rotation-only. Position/scale tracks = hip-float + stretch.
    if (/\.position$|\.scale$/.test(track.name)) continue;

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
  if (tracks.length === 0) return stripPositionAndScaleTracks(clip);
  const next =
    tracks.length === clip.tracks.length && rewritten === 0
      ? clip
      : new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode);
  if (rewritten > 0) {
    console.info(
      `[grudge-kit] rematchClipToSkeleton "${clip.name}": rewrote ${rewritten}/${clip.tracks.length}`,
    );
  }
  const bindable = filterBindableTracks(root, next);
  return stripPos ? stripPositionAndScaleTracks(bindable) : bindable;
}

/** Drop .position / .scale tracks — keep grounded kits sturdy (no limb stretch). */
export function stripPositionAndScaleTracks(clip: THREE.AnimationClip): THREE.AnimationClip {
  const keep = clip.tracks.filter((t) => !/\.position$|\.scale$/.test(t.name));
  if (keep.length === clip.tracks.length) return clip;
  return new THREE.AnimationClip(clip.name, clip.duration, keep, clip.blendMode);
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

/**
 * Resolve a character's hand bone / weapon socket for attachment.
 * Prefer order (grudge6 / uMMORPG / Mixamo):
 *   1. Hand containers (`R_hand_container` / `L_hand_container`)
 *   2. Bip001 hand (`Bip001 R Hand` / `Bip001_R_Hand`)
 *   3. Mixamo (`mixamorigRightHand` / `RightHand`)
 *   4. Fuzzy hand/wrist (excludes fingers)
 */
export function findHandBone(root: THREE.Object3D, side: "L" | "R"): THREE.Object3D | null {
  const containers =
    side === "R"
      ? ["R_hand_container", "R_Hand_Container", "RightHandContainer", "weapon_r"]
      : ["L_hand_container", "L_Hand_Container", "LeftHandContainer", "L_shield_container", "weapon_l"];
  const exactHands =
    side === "R"
      ? [
          "Bip001_R_Hand",
          "Bip001 R Hand",
          "Bip001_R Hand",
          "mixamorigRightHand",
          "mixamorig:RightHand",
          "RightHand",
        ]
      : [
          "Bip001_L_Hand",
          "Bip001 L Hand",
          "Bip001_L Hand",
          "mixamorigLeftHand",
          "mixamorig:LeftHand",
          "LeftHand",
        ];
  const exactSet = new Set([...containers, ...exactHands].map((n) => n.toLowerCase()));
  let containerHit: THREE.Object3D | null = null;
  let exactHit: THREE.Object3D | null = null;
  let fuzzyHit: THREE.Object3D | null = null;
  let fuzzyName = "";
  const want = side === "R" ? /rhand|righthand|handr|rwrist/ : /lhand|lefthand|handl|lwrist/;
  const isFinger = /finger|thumb|index|middle|ring|pinky|pinkie|metacarp|digit/;
  const containerRe = /container|socket/;

  root.traverse((node) => {
    if (containerHit && exactHit) return;
    const lower = node.name.toLowerCase();
    if (exactSet.has(lower)) {
      if (containerRe.test(lower) || containers.some((c) => c.toLowerCase() === lower)) {
        containerHit = node;
      } else {
        exactHit = node;
      }
      return;
    }
    const norm = lower.replace(/[^a-z0-9]/g, "");
    if (containerRe.test(norm) && want.test(norm)) {
      if (!containerHit) containerHit = node;
      return;
    }
    if (!want.test(norm) || isFinger.test(norm)) return;
    if (!fuzzyHit || norm.length < fuzzyName.length) {
      fuzzyHit = node;
      fuzzyName = norm;
    }
  });
  return containerHit ?? exactHit ?? fuzzyHit;
}
