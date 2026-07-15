import * as THREE from "three";
import { assetLoadError, resolveGrudgeAssetCandidates } from "./assetBase";
import { prepTexture } from "../texturePrep";

const textureLoader = new THREE.TextureLoader();

// Load a body-atlas texture across fleet hosts (R2 textures/grudge6 + assets/*).
// The atlas is a lossless `.webp`; sRGB + mipmaps + anisotropy for distance quality.
// flipY = true (FBX UVs were authored for TGALoader's flipped orientation).
// Pass extra logical paths via `extraPaths` (e.g. race textureFallbacks).
export async function loadBodyTexture(
  textureUrl: string,
  extraPaths?: string[],
): Promise<THREE.Texture> {
  const logical = [textureUrl, ...(extraPaths ?? [])];
  const candidates: string[] = [];
  for (const p of logical) {
    if (/^([a-z]+:)?\/\//i.test(p)) candidates.push(p);
    else candidates.push(...resolveGrudgeAssetCandidates(p));
  }
  const urls = [...new Set(candidates)];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const tex = await textureLoader.loadAsync(url);
      // FBX race kits need flipped Y; mipmaps stop shimmer at mid-distance.
      prepTexture(tex, { sRGB: true, mipmaps: true, flipY: true });
      return tex;
    } catch (err) {
      lastErr = err;
    }
  }
  throw assetLoadError(textureUrl, lastErr);
}
