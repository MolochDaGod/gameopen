/**
 * uMMORPG / Toon RTS skeleton + prefab socket resolution (Bip001).
 *
 * Unity reference patterns (Grudge Warlords / uMMORPG):
 *  - Entity root owns transform; visual is child (model)
 *  - Animator on same hierarchy as Bip001
 *  - Weapons parent under R_hand_container / L_hand_container / L_shield_container
 *  - Equipment = child mesh visibility, not body swap
 *
 * Web port: same bone names + containers after FBX load + unifySkeletons.
 */
import * as THREE from "three";
import { findHandBone, unifySkeletons } from "../grudge/skeleton";

export type SocketId =
  | "root"
  | "hips"
  | "head"
  | "hand_r"
  | "hand_l"
  | "container_r"
  | "container_l"
  | "container_shield"
  | "quiver"
  | "bag"
  | "wood";

export interface SkeletonSockets {
  root: THREE.Object3D | null;
  hips: THREE.Object3D | null;
  head: THREE.Object3D | null;
  handR: THREE.Object3D | null;
  handL: THREE.Object3D | null;
  /** uMMORPG / Toon RTS mount points */
  containerR: THREE.Object3D | null;
  containerL: THREE.Object3D | null;
  containerShield: THREE.Object3D | null;
  quiver: THREE.Object3D | null;
  bag: THREE.Object3D | null;
  wood: THREE.Object3D | null;
  /** All bones by exact name */
  bones: Map<string, THREE.Bone>;
  skeleton: THREE.Skeleton | null;
}

const HIP_NAMES = [
  "Bip001",
  "Bip001 Pelvis",
  "Bip001_Pelvis",
  "Bip001 Pelvis",
  "Pelvis",
  "Hips",
  "mixamorig:Hips",
  "mixamorigHips",
];

const HEAD_NAMES = ["Bip001 Head", "Bip001_Head", "Head", "mixamorig:Head"];

const CONTAINER_R = ["R_hand_container", "R_Hand_Container", "RightHandContainer", "weapon_r"];
const CONTAINER_L = ["L_hand_container", "L_Hand_Container", "LeftHandContainer", "weapon_l"];
const CONTAINER_SHIELD = [
  "L_shield_container",
  "L_Shield_Container",
  "Shield_container",
  "shield_container",
];
const QUIVER = ["Quiver_container", "quiver_container", "Bone_quiver"];
const BAG = ["Bone_bag", "bag_container", "Bag_container"];
const WOOD = ["Bone_wood", "wood_container"];

function findByNames(root: THREE.Object3D, names: string[]): THREE.Object3D | null {
  const want = new Set(names.map((n) => n.toLowerCase()));
  let hit: THREE.Object3D | null = null;
  root.traverse((n) => {
    if (hit) return;
    if (want.has(n.name.toLowerCase())) hit = n;
  });
  return hit;
}

function findFuzzy(root: THREE.Object3D, re: RegExp, exclude?: RegExp): THREE.Object3D | null {
  let hit: THREE.Object3D | null = null;
  let best = 999;
  root.traverse((n) => {
    const nm = n.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (exclude && exclude.test(nm)) return;
    if (!re.test(nm)) return;
    if (nm.length < best) {
      best = nm.length;
      hit = n;
    }
  });
  return hit;
}

/**
 * Catalog skeleton sockets after kit load.
 * Call after unifySkeletons for Toon RTS multi-skeleton FBX.
 */
export function resolveSkeletonSockets(root: THREE.Object3D): SkeletonSockets {
  const skeleton = unifySkeletons(root);
  const bones = new Map<string, THREE.Bone>();
  root.traverse((n) => {
    if ((n as THREE.Bone).isBone) bones.set(n.name, n as THREE.Bone);
  });

  let hips =
    findByNames(root, HIP_NAMES) ||
    findFuzzy(root, /^(bip001|pelvis|hips)/, /finger|toe/);
  // Prefer Bip001 bone node if present
  if (bones.has("Bip001")) hips = bones.get("Bip001")!;
  if (bones.has("Bip001 Pelvis")) hips = bones.get("Bip001 Pelvis")!;
  if (bones.has("Bip001_Pelvis")) hips = bones.get("Bip001_Pelvis")!;

  const head =
    findByNames(root, HEAD_NAMES) || findFuzzy(root, /head/, /headtop|end|nub/);

  const handR = findHandBone(root, "R");
  const handL = findHandBone(root, "L");

  const containerR =
    findByNames(root, CONTAINER_R) || handR;
  const containerL =
    findByNames(root, CONTAINER_L) || handL;
  const containerShield =
    findByNames(root, CONTAINER_SHIELD) || containerL;

  return {
    root: hips || root,
    hips,
    head,
    handR,
    handL,
    containerR,
    containerL,
    containerShield,
    quiver: findByNames(root, QUIVER),
    bag: findByNames(root, BAG),
    wood: findByNames(root, WOOD),
    bones,
    skeleton,
  };
}

/**
 * Ground feet to local y=0 using skinned body bbox (uMMORPG entity Y snap).
 */
export function groundFeet(root: THREE.Object3D): void {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  let any = false;
  root.traverse((n) => {
    const m = n as THREE.SkinnedMesh;
    if (m.isSkinnedMesh || (n as THREE.Mesh).isMesh) {
      box.expandByObject(n);
      any = true;
    }
  });
  if (!any) box.setFromObject(root);
  if (isFinite(box.min.y)) root.position.y -= box.min.y;
}

/**
 * Attach a held item under the preferred socket (container first, then hand).
 * Mirrors uMMORPG EquipmentItem mount under hand transform.
 */
export function attachToSocket(
  item: THREE.Object3D,
  sockets: SkeletonSockets,
  side: "R" | "L" | "shield" | "quiver" | "bag" = "R",
): THREE.Object3D | null {
  let parent: THREE.Object3D | null = null;
  if (side === "R") parent = sockets.containerR || sockets.handR;
  else if (side === "L") parent = sockets.containerL || sockets.handL;
  else if (side === "shield") parent = sockets.containerShield || sockets.containerL || sockets.handL;
  else if (side === "quiver") parent = sockets.quiver || sockets.containerL;
  else if (side === "bag") parent = sockets.bag || sockets.hips;
  if (!parent) return null;
  parent.add(item);
  item.position.set(0, 0, 0);
  item.rotation.set(0, 0, 0);
  item.scale.set(1, 1, 1);
  return parent;
}

/** Debug: list bone names for prefab validation. */
export function listBoneNames(root: THREE.Object3D): string[] {
  const names: string[] = [];
  root.traverse((n) => {
    if ((n as THREE.Bone).isBone) names.push(n.name);
  });
  return names.sort();
}

/**
 * Prefab readiness checklist (uMMORPG Entity spawn gate).
 */
export function validatePrefabSockets(sockets: SkeletonSockets): {
  ok: boolean;
  missing: string[];
  warnings: string[];
} {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (!sockets.hips) missing.push("hips/Bip001");
  if (!sockets.handR) missing.push("hand_r");
  if (!sockets.handL) warnings.push("hand_l (optional for 2H)");
  if (!sockets.containerR) warnings.push("R_hand_container — using hand bone");
  if (!sockets.head) warnings.push("head bone");
  if (!sockets.skeleton) warnings.push("unified skeleton missing");
  return { ok: missing.length === 0, missing, warnings };
}
