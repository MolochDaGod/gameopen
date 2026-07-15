/**
 * Shared texture + material preparation for Danger Room / Open loaders.
 *
 * Goals:
 *  - Correct colour spaces (sRGB maps vs linear data maps)
 *  - Mipmaps + anisotropic filtering so distant characters don't shimmer
 *  - One place for "make this GLB look right" after load
 */
import * as THREE from "three";

/** Max anisotropy we request (clamped to GPU limit when a renderer is known). */
let maxAnisotropy = 8;

/** Call once after WebGLRenderer exists so textures can use full anisotropy. */
export function bindTextureAnisotropy(renderer: THREE.WebGLRenderer): void {
  try {
    maxAnisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy() || 8);
  } catch {
    maxAnisotropy = 8;
  }
}

export function getTextureAnisotropy(): number {
  return maxAnisotropy;
}

export interface PrepTextureOptions {
  /** Colour maps / albedo — sRGB. Data maps (normal/rough/metal) stay linear. */
  sRGB?: boolean;
  /** Prefer mipmaps for 3D mesh maps (default true). Canvas HUD sprites often false. */
  mipmaps?: boolean;
  flipY?: boolean;
}

/**
 * Normalize a texture for production rendering.
 * Safe on CanvasTexture / compressed textures (skips generateMipmaps when unsupported).
 */
export function prepTexture(
  tex: THREE.Texture,
  opts: PrepTextureOptions = {},
): THREE.Texture {
  const sRGB = opts.sRGB !== false;
  const mips = opts.mipmaps !== false;

  if ("colorSpace" in tex) {
    tex.colorSpace = sRGB ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
  } else {
    // three r150- compat
    (tex as THREE.Texture & { encoding?: number }).encoding = sRGB ? 3001 : 3000;
  }

  if (opts.flipY !== undefined) tex.flipY = opts.flipY;

  // Compressed textures (KTX2) already ship mips; only toggle on 2D images.
  const isCompressed =
    (tex as THREE.CompressedTexture).isCompressedTexture === true ||
    (tex as THREE.Texture & { isCompressedArrayTexture?: boolean }).isCompressedArrayTexture === true;

  if (!isCompressed) {
    tex.generateMipmaps = mips;
    tex.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
  }
  tex.anisotropy = Math.max(tex.anisotropy || 1, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

const DATA_MAP_KEYS = [
  "normalMap",
  "roughnessMap",
  "metalnessMap",
  "aoMap",
  "emissiveMap",
  "bumpMap",
  "displacementMap",
  "alphaMap",
] as const;

/**
 * Walk a loaded GLB/FBX and fix materials + maps for PBR rendering.
 * - Albedo/emissive maps → sRGB + mips
 * - Data maps → linear
 * - Soften chrome metalness without an env map (grey heroes)
 */
export function prepObjectMaterials(
  root: THREE.Object3D,
  opts?: { neutralizeMetal?: boolean; receiveShadow?: boolean },
): void {
  const neutralize = opts?.neutralizeMetal !== false;
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    if (opts?.receiveShadow !== false) mesh.receiveShadow = true;
    // Keep skinned bodies visible when close to camera (avoid pop-out).
    if (mesh instanceof THREE.SkinnedMesh) mesh.frustumCulled = false;

    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if (!m) continue;

      if (m instanceof THREE.MeshStandardMaterial || m instanceof THREE.MeshPhysicalMaterial) {
        if (m.map) prepTexture(m.map, { sRGB: true, mipmaps: true });
        if (m.emissiveMap) prepTexture(m.emissiveMap, { sRGB: true, mipmaps: true });
        if (m.envMap) {
          // env maps are usually already correct; leave color space alone
        }
        for (const key of DATA_MAP_KEYS) {
          const t = (m as unknown as Record<string, THREE.Texture | null>)[key];
          if (t && t instanceof THREE.Texture) {
            prepTexture(t, { sRGB: false, mipmaps: true });
          }
        }

        if (neutralize && m.metalness > 0.05 && !m.envMap) {
          m.metalness = Math.min(m.metalness, 0.15);
          if (m.roughness < 0.4) m.roughness = 0.55;
        }
        // Black base color + map → white so the atlas shows
        if (m.map && m.color.getHex() === 0x000000) m.color.setHex(0xffffff);
        if (!m.map && m.color.getHex() === 0x000000) m.color.setHex(0x888888);

        m.envMapIntensity = m.envMapIntensity ?? 0.6;
        m.needsUpdate = true;
      } else if (
        m instanceof THREE.MeshBasicMaterial ||
        m instanceof THREE.MeshLambertMaterial ||
        m instanceof THREE.MeshPhongMaterial
      ) {
        if (m.map) {
          prepTexture(m.map, { sRGB: true, mipmaps: true });
          if (m.color.getHex() === 0x000000) m.color.setHex(0xffffff);
          m.needsUpdate = true;
        }
      }
    }
  });
}
