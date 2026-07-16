import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { assetLoadError, resolveGrudgeAssetCandidates } from "./assetBase";
import { powerOfTenScale, unifySkeletons } from "./skeleton";

export interface LoadedCharacter {
  /** Auto-fit FBX group: ~2 units tall, feet on y=0, facing +Z. */
  group: THREE.Group;
  skeleton: THREE.Skeleton | null;
  mixer: THREE.AnimationMixer;
  meshNames: string[];
}

// Load + normalize a customizable race FBX across fleet hosts:
//   FBXLoader -> unifySkeletons -> face +Z -> per-mesh power-of-ten unit
//   normalization (over NON-skinned meshes) -> auto-fit bbox computed over
//   SkinnedMesh body parts ONLY -> scale to target height -> sit feet on y=0.
export async function loadCharacterModel(modelUrl: string): Promise<LoadedCharacter> {
  const candidates = /^([a-z]+:)?\/\//i.test(modelUrl)
    ? [modelUrl]
    : resolveGrudgeAssetCandidates(modelUrl);
  let lastErr: unknown;
  for (const url of candidates) {
    try {
      // Magic-byte / content-type gate — never parse HTML error pages as FBX
      if (typeof fetch !== "undefined") {
        const probe = await fetch(url, { method: "HEAD", mode: "cors", cache: "no-store" }).catch(
          () => null,
        );
        if (probe) {
          const ct = (probe.headers.get("content-type") || "").toLowerCase();
          if (ct.includes("text/html") || !probe.ok) {
            lastErr = new Error(`not FBX (ct=${ct} status=${probe.status}) ${url}`);
            continue;
          }
        }
      }
      // Fresh loader per URL so resourcePath points at the FBX directory
      // (relative TGA/PNG embeds resolve against the CDN folder, not the SPA).
      const fbxLoader = new FBXLoader();
      try {
        const u = new URL(url, typeof window !== "undefined" ? window.location.href : "https://assets.grudge-studio.com/");
        const dir = u.href.slice(0, u.href.lastIndexOf("/") + 1);
        fbxLoader.setResourcePath(dir);
      } catch {
        /* ignore bad URL parse */
      }
      const fbx = await fbxLoader.loadAsync(url);
      const meshNames: string[] = [];
      let skinned = 0;
      fbx.traverse((child) => {
        if (child instanceof THREE.SkinnedMesh || child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.name) meshNames.push(child.name);
          if (child instanceof THREE.SkinnedMesh) skinned++;
        }
      });
      if (skinned === 0 && meshNames.length === 0) {
        lastErr = new Error(`empty mesh kit ${url}`);
        continue;
      }
      const skeleton = normalizeCharacterGroup(fbx);
      const mixer = new THREE.AnimationMixer(fbx);
      return { group: fbx, skeleton, mixer, meshNames };
    } catch (err) {
      lastErr = err;
    }
  }
  throw assetLoadError(modelUrl, lastErr);
}

// Normalize a freshly-parsed customizable race FBX in place. Steps:
//   unifySkeletons -> face +Z -> per-mesh power-of-ten unit normalization (over
//   NON-skinned meshes) -> auto-fit bbox over SkinnedMesh body parts ONLY ->
//   scale to ~2 units -> sit feet on y=0. Static off-origin gear meshes never
//   warp the scale. Returns the widest unified skeleton (or null).
export function normalizeCharacterGroup(fbx: THREE.Object3D): THREE.Skeleton | null {
  // Collapse the ~27 per-mesh disconnected skeletons onto ONE canonical chain so
  // animation clips actually deform every mesh.
  const skeleton = unifySkeletons(fbx);

  // Face +Z (toward the default camera) at zero facing-rotation.
  fbx.rotation.y = Math.PI / 2;
  fbx.updateWorldMatrix(true, true);

  // ── Per-mesh unit normalization (non-skinned meshes only) ──────────
  const _p = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const effScaleOf = (node: THREE.Object3D): number => {
    node.matrixWorld.decompose(_p, _q, _s);
    return Math.max(Math.abs(_s.x), Math.abs(_s.y), Math.abs(_s.z));
  };
  const skinnedEff: number[] = [];
  fbx.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh) skinnedEff.push(effScaleOf(node));
  });
  skinnedEff.sort((a, b) => a - b);
  const refEff = skinnedEff.length > 0 ? skinnedEff[Math.floor(skinnedEff.length / 2)] : 1;
  let normalizedAny = false;
  fbx.traverse((node) => {
    if (node instanceof THREE.Mesh && !(node instanceof THREE.SkinnedMesh)) {
      const correction = powerOfTenScale(refEff, effScaleOf(node));
      if (correction !== 1) {
        node.scale.multiplyScalar(correction);
        normalizedAny = true;
      }
    }
  });
  if (normalizedAny) fbx.updateWorldMatrix(true, true);

  // ── Auto-fit by HEIGHT only (never max(x,y,z) — wide gear warped scale) ──
  const TARGET_H = 1.8;
  const bodyBox = new THREE.Box3();
  let bodyMeshCount = 0;
  fbx.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh) {
      bodyBox.expandByObject(node);
      bodyMeshCount++;
    }
  });
  const box = bodyMeshCount > 0 ? bodyBox : new THREE.Box3().setFromObject(fbx);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const height = size.y > 1e-6 ? size.y : Math.max(size.x, size.z, 1);
  // Decade unit snap (cm exports → metres)
  let unit = 1;
  if (height > 50 || height < 0.05) {
    unit = Math.pow(10, Math.round(Math.log10(TARGET_H / height)));
  }
  const fit = (TARGET_H / (height * unit)) * unit;
  const clamped = Math.min(12, Math.max(0.02, fit));
  fbx.scale.setScalar(clamped);
  fbx.userData.bodyRawHeight = height;
  fbx.userData.grudgeHeightFit = true;

  // Sit feet on y=0 — re-measure body-only after scaling.
  fbx.updateWorldMatrix(true, true);
  const bodyBox2 = new THREE.Box3();
  fbx.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh) bodyBox2.expandByObject(node);
  });
  const box2 = bodyMeshCount > 0 ? bodyBox2 : new THREE.Box3().setFromObject(fbx);
  fbx.position.set(-center.x * fbx.scale.x, -box2.min.y, -center.z * fbx.scale.z);

  return skeleton;
}

/**
 * Fuzzy mesh key — matches gear preset / D1 mesh_ids to in-file Toon RTS names
 * (grudge6-modular-characters SSOT). Exact name match fails across Units_/case.
 */
export function meshKey(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/^wk_|^brb_|^orc_|^elf_|^ud_|^dwf_/, "")
    .replace(/units_/g, "")
    .replace(/xtra_/g, "")
    .replace(/weapon_/g, "weapon")
    .replace(/[^a-z0-9]/g, "");
}

function isEquippableMeshName(n: string): boolean {
  return (
    /^(WK_|BRB_|ORC_|ELF_|UD_|DWF_)/i.test(n) ||
    /body|arms|legs|head|shoulder|weapon|shield|xtra|quiver|staff|sword|bow|axe|hammer|mace|spear|dagger|pick/i.test(
      n,
    )
  );
}

/**
 * Show only the preset's armour + weapon meshes (child visibility).
 * Uses fuzzy meshKey matching — never exact string equality alone.
 */
export function applyGearPreset(group: THREE.Object3D, visibleMeshes: string[]): void {
  if (!visibleMeshes.length) return;
  const wantKeys = visibleMeshes.map(meshKey);
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh) && !(node instanceof THREE.SkinnedMesh)) return;
    const n = node.name;
    if (!n || !isEquippableMeshName(n)) return;
    const key = meshKey(n);
    let show = false;
    for (const w of wantKeys) {
      if (key === w || key.endsWith(w) || w.endsWith(key)) {
        show = true;
        break;
      }
    }
    node.visible = show;
  });
}

/**
 * Bind the shared Toon RTS race atlas to every mesh as MeshStandardMaterial.
 * Contract (grudge6-modular-characters):
 *   map + white color, metalness 0, roughness ~0.75, DoubleSide.
 * One material is shared across all meshes (weapons use the same body atlas).
 * Returns the material so the owner can dispose it (texture is owned separately).
 */
export function applyBodyTexture(group: THREE.Object3D, texture: THREE.Texture): THREE.Material {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    metalness: 0,
    roughness: 0.75,
    side: THREE.DoubleSide,
  });
  group.traverse((node) => {
    if (node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) {
      node.material = material;
    }
  });
  return material;
}
