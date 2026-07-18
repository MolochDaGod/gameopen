/**
 * SSOT for Desktop `h elpers.glb` — Forge showcase pack used as:
 *   - Landing / load intro (full scene + AstroCreeper character)
 *   - Arena combat floor (same mesh with the character stripped)
 *
 * Hierarchy (AuxScene → ForgeScene):
 *   tools (Pickaxe, Hammer, Knife, …) + Sketchfab arena set
 *   (AstroCreeper_Short_Curcuit_Variant + chair + computer/rest)
 */
import * as THREE from "three";

/** Public paths (same binary; first hit wins via loadGltfFirst). */
export const HELPERS_FORGE_PATHS = [
  "models/landing/helpers.glb",
  "models/helpers-forge.glb",
  "models/helpers-arena.glb",
  "models/helpers-intro.glb",
] as const;

/** Arena combat map (character removed at runtime). */
export const HELPERS_ARENA_PATHS = [
  "models/helpers-arena.glb",
  "models/landing/helpers.glb",
  "models/helpers-forge.glb",
] as const;

/** Node-name fragments that identify the showcase character (not arena props). */
const CHARACTER_NAME_RE =
  /astrocreeper|short_curcuit|short.?circuit|variant_18|creeper/i;

/** Optional prop tool names for intro ring extraction. */
export const HELPER_TOOL_NAMES = [
  "Pickaxe",
  "Hammer_Circle027",
  "Knife",
  "Shovel",
  "Shovel_1",
  "Bucket",
  "FirstAidKit_Hard",
  "FishingRod_Lvl2",
  "Lure_2",
] as const;

/**
 * Find the AstroCreeper (or similar) character root inside a loaded helpers pack.
 */
export function findHelpersCharacter(root: THREE.Object3D): THREE.Object3D | null {
  let hit: THREE.Object3D | null = null;
  root.traverse((o) => {
    if (hit) return;
    if (o.name && CHARACTER_NAME_RE.test(o.name)) hit = o;
  });
  // Fallback: Head + Body sibling group under a Sketchfab root
  if (!hit) {
    root.traverse((o) => {
      if (hit) return;
      if (/Head_2|Body_5|RightArm|LeftArm/i.test(o.name) && o.parent) {
        // Walk up to the variant root if present
        let p: THREE.Object3D | null = o;
        while (p?.parent && p.parent !== root && p.parent.type !== "Scene") {
          if (CHARACTER_NAME_RE.test(p.name) || /_18$/.test(p.name)) {
            hit = p;
            return;
          }
          p = p.parent;
        }
        if (!hit && o.parent) hit = o.parent.parent ?? o.parent;
      }
    });
  }
  return hit;
}

/**
 * Remove the showcase character from a cloned arena scene so fighters have floor
 * space without a second hero mesh. Mutates `root` in place; returns whether a
 * character was found and removed.
 */
export function stripHelpersCharacter(root: THREE.Object3D): boolean {
  const char = findHelpersCharacter(root);
  if (!char) return false;
  char.parent?.remove(char);
  char.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry?.dispose?.();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) mat.dispose?.();
    }
  });
  return true;
}

/** Soft circle pad under the hero for intro / load screen. */
export function makeIntroCircle(
  radius = 3.2,
  color = 0x3a8cff,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 72),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  mesh.name = "intro-circle";
  mesh.renderOrder = -1;
  return mesh;
}

/** Outer glow ring (thin torus-like disc edge). */
export function makeIntroRing(radius = 3.35, color = 0x7ec8ff): THREE.Mesh {
  const geo = new THREE.RingGeometry(radius * 0.92, radius, 72);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.03;
  mesh.name = "intro-ring";
  return mesh;
}

/**
 * Plant object so feet sit on y=0 and optional uniform height scale.
 * Returns the applied world height.
 */
export function plantOnGround(obj: THREE.Object3D, targetHeight?: number): number {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  if (targetHeight && size.y > 1e-4) {
    const s = targetHeight / size.y;
    obj.scale.multiplyScalar(s);
    obj.updateMatrixWorld(true);
  }
  const box2 = new THREE.Box3().setFromObject(obj);
  obj.position.y -= box2.min.y;
  const box3 = new THREE.Box3().setFromObject(obj);
  return box3.getSize(new THREE.Vector3()).y;
}

/** Center XZ on origin, keep planted Y. */
export function centerXZ(obj: THREE.Object3D): void {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  const c = box.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
}

export function prepHelperMeshes(root: THREE.Object3D, cast = true): void {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = cast;
    m.receiveShadow = true;
    m.frustumCulled = false;
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      if (!mat) continue;
      mat.side = THREE.DoubleSide;
      if ("map" in mat && mat.map) {
        (mat.map as THREE.Texture).colorSpace = THREE.SRGBColorSpace;
      }
    }
  });
}

/**
 * Seat the whole forge pack: center XZ, plant on ground, optional scale so the
 * arena span fits a target max XZ extent.
 */
export function fitForgeScene(
  root: THREE.Object3D,
  opts?: { maxXZ?: number; lift?: number },
): { height: number; span: number } {
  prepHelperMeshes(root, true);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= box.min.y;
  const maxXZ = opts?.maxXZ;
  if (maxXZ && Math.max(size.x, size.z) > maxXZ) {
    const s = maxXZ / Math.max(size.x, size.z);
    root.scale.setScalar(s);
    root.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(root);
    root.position.y -= b2.min.y;
  }
  if (opts?.lift) root.position.y += opts.lift;
  root.updateMatrixWorld(true);
  const final = new THREE.Box3().setFromObject(root);
  const fs = final.getSize(new THREE.Vector3());
  return { height: fs.y, span: Math.max(fs.x, fs.z) };
}
