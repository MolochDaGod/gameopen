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

  // Face +Z (Controller art-forward when root.yaw = 0). Toon RTS FBX ships +X.
  // Mark artForwardSet so deployCharacterModel does not double-rotate.
  fbx.rotation.y = Math.PI / 2;
  fbx.userData.artForwardSet = true;
  fbx.userData.artForwardYaw = Math.PI / 2;
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

/** Hide every equippable wardrobe piece (body/armor/weapon). Call before equip. */
export function hideEquippableMeshes(group: THREE.Object3D): void {
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh) && !(node instanceof THREE.SkinnedMesh)) return;
    const n = node.name;
    if (!n || !isEquippableMeshName(n)) return;
    node.visible = false;
  });
}

/**
 * Nuclear hide: every Mesh/SkinnedMesh on a modular race kit.
 * Use before exclusive loadout show — prevents leftover props/variants.
 */
export function hideAllKitMeshes(group: THREE.Object3D): void {
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh) && !(node instanceof THREE.SkinnedMesh)) return;
    // Keep pure bone helpers if any were mis-typed as Mesh
    if ((node as THREE.Bone).isBone) return;
    node.visible = false;
  });
}

function meshRole(key: string): string | null {
  if (/weapon|sword|axe|bow|staff|spear|dagger|hammer|mace|pick|shield|quiver|xtra/.test(key)) {
    if (/shield/.test(key)) return "shield";
    if (/quiver|xtra|bag|wood/.test(key)) return "utility";
    return "weapon";
  }
  if (/body/.test(key)) return "body";
  if (/head|hat|tricorn/.test(key)) return "head";
  if (/arms/.test(key)) return "arms";
  if (/legs/.test(key)) return "legs";
  if (/shoulder/.test(key)) return "shoulders";
  return null;
}

/**
 * Show only the preset's armour + weapon meshes (child visibility).
 * Prefer exact meshKey match; never leave full wardrobe on.
 *
 * HARD RULE (grudge6 modular): hide ALL kit meshes first, then show loadout only.
 * Exclusive slots: at most one body / arms / legs / head / weapon / shield.
 * Spiked-blob / flying planks = this was skipped or matching was too fuzzy.
 */
export function applyGearPreset(group: THREE.Object3D, visibleMeshes: string[]): void {
  if (!visibleMeshes.length) return;
  const wantKeys = visibleMeshes
    .filter((m) => !/^equip:/i.test(m))
    .map(meshKey)
    .filter(Boolean);

  // 1) Hide entire kit wardrobe (not only "equippable" regex — that missed junk)
  hideAllKitMeshes(group);

  // 2) Score matches: exact > endsWith > includes
  type Cand = { node: THREE.Object3D; key: string; score: number; role: string | null };
  const cands: Cand[] = [];
  group.traverse((node) => {
    if (!(node instanceof THREE.Mesh) && !(node instanceof THREE.SkinnedMesh)) return;
    const n = node.name;
    if (!n) return;
    const key = meshKey(n);
    if (!key) return;
    let score = 0;
    for (const w of wantKeys) {
      if (key === w) score = Math.max(score, 100);
      else if (key.endsWith(w) || w.endsWith(key)) score = Math.max(score, 70);
      else if (key.includes(w) || w.includes(key)) score = Math.max(score, 40);
    }
    if (score > 0) cands.push({ node, key, score, role: meshRole(key) });
  });
  cands.sort((a, b) => b.score - a.score);

  // 3) Exclusive by role — first best match wins (kills multi-body / multi-weapon blob)
  const taken = new Set<string>();
  let matched = 0;
  for (const c of cands) {
    const role = c.role || c.key;
    // Utility can co-exist; exclusive armor/weapon slots
    if (role !== "utility" && taken.has(role)) continue;
    if (role !== "utility") taken.add(role);
    c.node.visible = true;
    matched++;
  }

  // 4) Fail-safe base armor only
  if (matched === 0) {
    console.warn(
      "[applyGearPreset] 0 mesh matches for",
      visibleMeshes.slice(0, 6),
      "— exclusive base body/head/arms/legs",
    );
    const roles = ["body", "head", "arms", "legs"];
    const shown = new Set<string>();
    group.traverse((node) => {
      if (!(node instanceof THREE.Mesh) && !(node instanceof THREE.SkinnedMesh)) return;
      const key = meshKey(node.name);
      for (const r of roles) {
        if (shown.has(r)) continue;
        if (key.includes(r) && !/weapon|shield/.test(key)) {
          node.visible = true;
          shown.add(r);
          matched++;
          break;
        }
      }
    });
  }

  // 5) Sanity: too many visible skinned = still a wardrobe bomb
  let visSkinned = 0;
  group.traverse((node) => {
    if (node instanceof THREE.SkinnedMesh && node.visible) visSkinned++;
  });
  if (visSkinned > 14) {
    console.error(
      `[applyGearPreset] wardrobe bomb: ${visSkinned} visible skinned — re-hiding non-body`,
    );
    group.traverse((node) => {
      if (!(node instanceof THREE.SkinnedMesh) || !node.visible) return;
      const key = meshKey(node.name);
      const r = meshRole(key);
      if (r === "weapon" || r === "shield" || r === "utility" || r === "shoulders") {
        // keep one weapon max already handled; drop extras
        if (r !== "weapon" && r !== "shield") return;
      }
      if (!r || (r !== "body" && r !== "head" && r !== "arms" && r !== "legs" && r !== "weapon" && r !== "shield")) {
        node.visible = false;
      }
    });
  }

  console.info(
    `[applyGearPreset] matched=${matched} visSkinned=${visSkinned} want=${wantKeys.length}`,
  );
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
    vertexColors: false,
    envMapIntensity: 0.35,
  });
  // Toon RTS atlas is authored for FBX UV layout; force white tint so atlas colors show.
  group.traverse((node) => {
    if (node instanceof THREE.Mesh || node instanceof THREE.SkinnedMesh) {
      node.material = material;
      node.castShadow = true;
      node.receiveShadow = true;
      if (node instanceof THREE.SkinnedMesh) node.frustumCulled = false;
    }
  });
  return material;
}
